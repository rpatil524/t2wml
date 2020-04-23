import os
import re
import json
import csv
import yaml
from SPARQLWrapper import SPARQLWrapper, JSON
from string import punctuation
from typing import Sequence, Union, Tuple, List, Dict, Any
from google.oauth2 import id_token
from google.auth.transport import requests
from backend_code import t2wml_exceptions as T2WMLExceptions
from backend_code.wikidata_property import get_property_type as gp
from app_config import GOOGLE_CLIENT_ID



def get_property_type(wikidata_property: str, sparql_endpoint: str) -> str:
    """
    This functions queries the wikidata to find out the type of a wikidata property
    :param wikidata_property:
    :param sparql_endpoint:
    :return:
    """
    return gp(wikidata_property, sparql_endpoint)

def check_special_characters(text: str) -> bool:
    """
    This function checks if the text is made up of only special characters
    :param text:
    :return:
    """
    return all(char in punctuation for char in str(text))


def check_if_string_is_invalid(text: str) -> bool:
    """
    This function checks if the text is empty or has only special characters
    :param text:
    :return:
    """
    if text is None or str(text).strip() == "" or check_special_characters(text) or str(text).strip().lower() == '#n/a':
        return True
    return False


def translate_precision_to_integer(precision: str) -> int:
    """
    This function translates the precision value to indexes used by wikidata
    :param precision:
    :return:
    """
    if isinstance(precision, int):
        return precision
    precision_map = {
        "gigayear": 0,
        "gigayears": 0,
        "100 megayears": 1,
        "100 megayear": 1,
        "10 megayears": 2,
        "10 megayear": 2,
        "megayears": 3,
        "megayear": 3,
        "100 kiloyears": 4,
        "100 kiloyear": 4,
        "10 kiloyears": 5,
        "10 kiloyear": 5,
        "millennium": 6,
        "century": 7,
        "10 years": 8,
        "10 year": 8,
        "years": 9,
        "year": 9,
        "months": 10,
        "month": 10,
        "days": 11,
        "day": 11,
        "hours": 12,
        "hour": 12,
        "minutes": 13,
        "minute": 13,
        "seconds": 14,
        "second": 14
    }
    return precision_map[precision.lower()]


def natural_sort_key(s: str) -> list:
    """
    This function generates the key for the natural sorting algorithm
    :param s:
    :return:
    """
    _nsre = re.compile('([0-9]+)')
    return [int(text) if text.isdigit() else text.lower() for text in re.split(_nsre, s)]


def verify_google_login(tn: str) -> Tuple[dict, dict]:
    """
    This function verifies the oauth token by sending a request to Google's server.
    :param tn:
    :return:
    """
    error = None
    try:
        # client_id = '552769010846-tpv08vhddblg96b42nh6ltg36j41pln1.apps.googleusercontent.com'
        request = requests.Request()
        user_info = id_token.verify_oauth2_token(tn, request, GOOGLE_CLIENT_ID)

        if user_info['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
            raise T2WMLExceptions.AuthenticationFailureException("Token issued by an invalid issuer")
            user_info = None

    except ValueError as exception:
        user_info = None
        raise T2WMLExceptions.AuthenticationFailureException(str(exception))
    return user_info, error


def query_wikidata_for_label_and_description(items: str, sparql_endpoint: str):
    query = """PREFIX wd: <http://www.wikidata.org/entity/>
            PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
            PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
            SELECT ?qnode (MIN(?label) AS ?label) (MIN(?desc) AS ?desc) WHERE { 
              VALUES ?qnode {""" + items + """} 
              ?qnode rdfs:label ?label; <http://schema.org/description> ?desc.
              FILTER (langMatches(lang(?label),"EN"))
              FILTER (langMatches(lang(?desc),"EN"))
            }
            GROUP BY ?qnode"""
    sparql = SPARQLWrapper(sparql_endpoint)
    sparql.setQuery(query)
    sparql.setReturnFormat(JSON)
    try:
        results = sparql.query().convert()
    except:
        return None
    response = dict()
    try:
        for i in range(len(results["results"]["bindings"])):
            qnode = results["results"]["bindings"][i]["qnode"]["value"].split("/")[-1]
            label = results["results"]["bindings"][i]["label"]["value"]
            desc = results["results"]["bindings"][i]["desc"]["value"]
            response[qnode] = {'label': label, 'desc': desc}
    except IndexError:
        pass
    return response


def save_wikified_result(serialized_row_data: List[dict], filepath: str):
    keys = ['context', 'col', 'row', 'value', 'item', 'label', 'desc']
    serialized_row_data.sort(key=lambda x: [x['context'], natural_sort_key(x['col']), natural_sort_key(x['row'])])
    with open(filepath, 'w', newline='', encoding="utf-8") as output_file:
        dict_writer = csv.DictWriter(output_file, keys)
        dict_writer.writeheader()
        dict_writer.writerows(serialized_row_data)


def validate_yaml(yaml_file_path, sparql_endpoint):
    with open(yaml_file_path, 'r') as stream:
        try:
            yaml_file_data = yaml.safe_load(stream)
        except Exception as e:
            raise T2WMLExceptions.InvalidYAMLFileException("Could not load Yaml File: "+str(e))

    errors = ""
    for key in yaml_file_data.keys():
        if key != 'statementMapping':
            errors+= "Unrecognized key '" + key + "' found\n"

    if 'statementMapping' in yaml_file_data:
        for key in yaml_file_data['statementMapping'].keys():
            if key not in {'region', 'template', 'created_by'}:
                errors+= "Unrecognized key '" + key + "' (statementMapping -> " + key + ") found\n"

        if 'created_by' in yaml_file_data['statementMapping']:
            if not yaml_file_data['statementMapping']['created_by']:
                errors+= "Value of key 'created_by' (statementMapping -> created_by) cannot be empty\n"

        if 'region' in yaml_file_data['statementMapping']:
            if yaml_file_data['statementMapping']['region']:
                yaml_region=yaml_file_data['statementMapping']['region']
                if isinstance(yaml_region, list):
                    for i in range(len(yaml_region)):
                        for key in yaml_region[i].keys():
                            if key not in {'left', 'right', 'top', 'bottom', 'skip_row', 'skip_column', 'skip_cell'}:
                                errors+= "Unrecognized key '" + key + "' (statementMapping -> region[" + str(i) + "] -> " + key + ") found\n"

                        for required_key in ['left', 'right', 'top', 'bottom']:
                            if required_key not in yaml_region[i]:
                                errors+= "Key"+required_key+ "(statementMapping -> region[" + str(i) + "] -> X) not found\n"

                        for optional_list_key in ['skip_row', 'skip_column', 'skip_cell']:
                            if optional_list_key in yaml_region[i]:
                                if not yaml_region[i][optional_list_key] or not isinstance(yaml_region[i][optional_list_key], list):
                                    errors+= "Value of key '"+optional_list_key+"' (statementMapping -> region[" + str(i) + "] -> skip_row) is not appropriate.\
                                            Value should be a list of T2WML expressions.\n"
                else:
                    errors+= "Value of  key 'region' (statementMapping -> region) must be a list\n"
            else:
                errors+= "Value of key 'region' (statementMapping -> region) cannot be empty\n"
        else:
            errors +="Key 'region' (statementMapping -> X) not found\n"

        if 'template' in yaml_file_data['statementMapping']:
            yaml_template=yaml_file_data['statementMapping']['template']
            if isinstance(yaml_template, dict):
                for key in yaml_template.keys():
                    if key not in {'item', 'property', 'value', 'qualifier', 'calendar', 'precision', 'time_zone', 'format', 'lang', 'longitude', 'latitude', 'unit'}:
                        errors+= "Unrecognized key '" + key + "' (statementMapping -> template -> " + key + ") found\n"

                for required_key in ['item', 'property', 'value']:
                    if required_key not in yaml_template:
                        errors+= "Key '" + required_key+ "' (statementMapping -> template -> X) not found\n"

                if 'qualifier' in yaml_template:
                    if yaml_template['qualifier']:
                        if isinstance(yaml_template['qualifier'], list):
                            qualifiers = yaml_template['qualifier']
                            for i in range(len(qualifiers)):
                                object = qualifiers[i]
                                if object and isinstance(object, dict):
                                    for key in object.keys():
                                        if key not in {'property', 'value', 'qualifier', 'calendar',
                                                        'precision', 'time_zone', 'format', 'lang', 'longitude',
                                                        'latitude', 'unit'}:
                                            errors+= "Unrecognized key '" + key + "' (statementMapping -> template -> qualifier[" + str(i) + "] -> " + key + ") found"
                                else:
                                    errors+= "Value of  key 'qualifier[" + str(i) + "]' (statementMapping -> template -> qualifier[" + str(i) + "]) \
                                        must be a dictionary\n"

                        else:
                            errors+="Value of  key 'qualifier' (statementMapping -> template -> qualifier) must be a list\n"
                    else:
                        errors+= "Value of key 'qualifier' (statementMapping -> template -> qualifier) cannot be empty\n"
            else:
                errors += "Value of  key 'template' (statementMapping -> template) must be a dictionary\n"
        else:
            errors+= "Key 'template' (statementMapping -> X) not found\n"
    else:
        errors+= "Key 'statementMapping' not found\n"
    
    if errors:
            raise T2WMLExceptions.ErrorInYAMLFileException(errors)
