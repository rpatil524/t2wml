from collections import defaultdict
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
                if isinstance(yaml_file_data['statementMapping']['region'], list):
                    for i in range(len(yaml_file_data['statementMapping']['region'])):
                        for key in yaml_file_data['statementMapping']['region'][i].keys():
                            if key not in {'left', 'right', 'top', 'bottom', 'skip_row', 'skip_column', 'skip_cell'}:
                                errors+= "Unrecognized key '" + key + "' (statementMapping -> region[" + str(i) + "] -> " + key + ") found\n"

                        if 'left' not in yaml_file_data['statementMapping']['region'][i]:
                            errors+= "Key 'left' (statementMapping -> region[" + str(i) + "] -> X) not found\n"


                        if 'right' not in yaml_file_data['statementMapping']['region'][i]:
                            errors+= "Key 'right' not found (" \
                                                        "statementMapping -> region[" + str(i) + "] -> X)\n"


                        if 'top' not in yaml_file_data['statementMapping']['region'][i]:
                            errors+= "Key 'top' (statementMapping -> region[" + str(i) + "] -> X) not found\n"

                        if 'bottom' not in yaml_file_data['statementMapping']['region'][i]:
                            errors+= "Key 'bottom' not found (" \
                                                        "statementMapping -> region[" + str(i) + "] -> X)\n"

                        if 'skip_row' in yaml_file_data['statementMapping']['region'][i]:
                            if not yaml_file_data['statementMapping']['region'][i]['skip_row'] or not isinstance(yaml_file_data['statementMapping']['region'][i]['skip_row'], list):
                                errors+= "Value of key 'skip_row' (statementMapping -> region[" + str(i) + "] -> skip_row) is not appropriate.\
                                        Value should be a list of T2WML expressions.\n"


                        if 'skip_column' in yaml_file_data['statementMapping']['region'][i]:
                            if not yaml_file_data['statementMapping']['region'][i]['skip_column'] or not isinstance(yaml_file_data['statementMapping']['region'][i]['skip_column'], list):
                                errors+= "Value of key 'skip_column' (statementMapping -> region[" + str(i) + "] -> skip_column) is not appropriate. \
                                    Value should be a list of T2WML expressions.\n"

                        if 'skip_cell' in yaml_file_data['statementMapping']['region'][i]:
                            if not yaml_file_data['statementMapping']['region'][i]['skip_cell'] or not isinstance(yaml_file_data['statementMapping']['region'][i]['skip_cell'], list):
                                errors+= "Value of key 'skip_cell' (statementMapping -> region[" + str(i) + "] -> skip_cell) is not appropriate.\
                                        Value should be a list of T2WML expressions.\n"
                else:
                    errors+= "Value of  key 'region' (statementMapping -> region) must be a list\n"
            else:
                errors+= "Value of key 'region' (statementMapping -> region) cannot be empty\n"
        else:
            errors +="Key 'region' (statementMapping -> X) not found\n"

        if 'template' in yaml_file_data['statementMapping']:
            if isinstance(yaml_file_data['statementMapping']['template'], dict):
                for key in yaml_file_data['statementMapping']['template'].keys():
                    if key not in {'item', 'property', 'value', 'qualifier', 'reference', 'calendar', 'precision', 'time_zone', 'format', 'lang', 'longitude', 'latitude', 'unit'}:
                        errors+= "Unrecognized key '" + key + "' (statementMapping -> template -> " + key + ") found\n"

                if 'item' not in yaml_file_data['statementMapping']['template']:
                    errors+= "Key 'item' (statementMapping -> template -> X) not found\n"

                if 'property' not in yaml_file_data['statementMapping']['template']:
                    errors+= "Key 'property' (statementMapping -> template -> X) not found\n"

                if 'value' not in yaml_file_data['statementMapping']['template']:
                    errors+= "Key 'value' (statementMapping -> template -> X) not found\n"

                list_type_attributes = ['reference', 'qualifier']
                for attribute in list_type_attributes:
                    if attribute in yaml_file_data['statementMapping']['template']:
                        if yaml_file_data['statementMapping']['template'][attribute]:
                            if isinstance(yaml_file_data['statementMapping']['template'][attribute], list):
                                attributes = yaml_file_data['statementMapping']['template'][attribute]
                                for i in range(len(attributes)):
                                    object = attributes[i]
                                    if object and isinstance(object, dict):
                                        for key in object.keys():
                                            if key not in {'property', 'value', 'calendar',
                                                            'precision', 'time_zone', 'format', 'lang', 'longitude',
                                                            'latitude', 'unit'}:
                                                errors+= "Unrecognized key '" + key + "' (statementMapping -> template -> " + attribute + "[" + str(i) + "] -> " + key + ") found\n"
                                    else:
                                        errors+= "Value of  key '" + attribute + "[" + str(i) + "]' (statementMapping -> template -> " + attribute + "[" + str(i) + "]) \
                                            must be a dictionary\n"

                            else:
                                errors+="Value of  key '" + attribute + "' (statementMapping -> template -> " + attribute + ") must be a list\n"
                        else:
                            errors+= "Value of key '" + attribute + "' (statementMapping -> template -> " + attribute + ") cannot be empty\n"
            else:
                errors += "Value of  key 'template' (statementMapping -> template) must be a dictionary\n"
        else:
            errors+= "Key 'template' (statementMapping -> X) not found\n"
    else:
        errors+= "Key 'statementMapping' not found\n"
    if errors:
            raise T2WMLExceptions.ErrorInYAMLFileException(errors)

#TODO
def check_if_item_exists(item: str, sparql_endpoint) -> bool:
    item = item.strip()
    query = """SELECT ?property WHERE  {  wd:""" + item + """ ?property ?value. }"""
    sparql = SPARQLWrapper(sparql_endpoint)
    sparql.setQuery(query)
    sparql.setReturnFormat(JSON)
    try:
        results = sparql.query().convert()
        value = results['results']['bindings']
        if value:
            return True
        else:
            return False
    except Exception:
        return False

def validate_item(item: str, sparql_endpoint: str, item_existence_map: dict):
    error = ""
    if item not in item_existence_map:
        item_exists = check_if_item_exists(item, sparql_endpoint)
        if item_exists:
            item_existence_map[item] = True
        else:
            error= "Item: " + item + " doesn't exist in wikidata"
    return error

def get_non_empty_dict(dictionary):
    non_empty_dict = dict()
    for key, value in dictionary.items():
        if value:
            non_empty_dict[key] = value
    return non_empty_dict

def merge_dicts(dict_1, dict_2):
    keys = set().union(dict_1, dict_2)
    merged_dict = dict()
    for key in keys:
        value_1 = dict_1.get(key, "")
        value_2 = dict_2.get(key, "")
        value = value_1 + value_2
        merged_dict[key] = value
    return merged_dict

def categorized_error_to_error_list(categorized_error, is_warning=False):
    error_list = list()
    for key, value in categorized_error.items():
        if key in T2WMLExceptions.exception_map:
            error = T2WMLExceptions.exception_map[key](value)
        else:
            error = T2WMLExceptions.T2WMLException(value)
        if is_warning:
            error_list.append(error.warning_dict)
        else:
            error_list.append(error.error_dict)
    return error_list

def validate_value(statement, location_of_object_in_yaml_file, sparql_endpoint) -> dict:
    property = statement['property']
    property_type = get_property_type(property, sparql_endpoint)
    errors = {'ErrorInYAMLFileException': "", 'ConstraintViolationErrorException': ""}
    if property_type != 'GlobeCoordinate':
        if 'value' not in statement:
            errors['ErrorInYAMLFileException']+= "Key 'value' (" + location_of_object_in_yaml_file + " -> X) not found\n"

    else:
        if 'latitude' not in statement:
            errors['ErrorInYAMLFileException']+= "Key 'latitude' (" + location_of_object_in_yaml_file + " -> X) not found\n"
        if 'longitude' not in statement:
            errors['ErrorInYAMLFileException']+= "Key 'longitude' (" + location_of_object_in_yaml_file + " -> X) not found\n"
        if 'precision' not in statement:
            errors['ErrorInYAMLFileException']+= "Key 'precision' (" + location_of_object_in_yaml_file + " -> X) not found\n"


    if not errors:
        if property_type == "WikibaseItem" or property_type == "WikibaseProperty":
                if not isinstance(statement['value'], str) or not statement['value'].isalnum:
                    errors['ErrorInYAMLFileException']+= "Value of key 'value' (" + location_of_object_in_yaml_file + " -> value ) should be a valid item\n"
        elif property_type == "String":
            if not isinstance(statement['value'], str):
                errors['ErrorInYAMLFileException']+= "Value of key 'value' (" + location_of_object_in_yaml_file + " -> value ) should be string\n"
        elif property_type == "Quantity":
            if not isinstance(statement['value'], int) and not (isinstance(statement['value'], str) and statement['value'].isdigit()):
                errors['ErrorInYAMLFileException']+= "Value of key 'value' (" + location_of_object_in_yaml_file + " -> value ) should be an integer\n"
        elif property_type == "GlobeCoordinate":
            try:
                latitude = float(statement['latitude'])
            except ValueError:
                errors['ErrorInYAMLFileException']+= "Value of key 'latitude' (" + location_of_object_in_yaml_file + " -> latitude ) should be a decimal\n"

            try:
                longitude = float(statement['longitude'])
            except ValueError:
                errors['ErrorInYAMLFileException']+= "Value of key 'longitude' (" + location_of_object_in_yaml_file + " -> longitude ) should be a decimal\n"

            try:
                precision = float(statement['precision'])
            except ValueError:
                errors['ErrorInYAMLFileException']+= "Value of key 'precision' (" + location_of_object_in_yaml_file + " -> precision ) should be a decimal\n"
        elif property_type == "Time":
            value_regex = re.compile(r"^[+-]?[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[1-2][0-9]|3[0-1])T[0-5][0-9]:[0-5][0-9]:[0-5][0-9][Z]?$")
            regex_matched = bool(value_regex.match(statement['value']))
            if not regex_matched:
                errors['ErrorInYAMLFileException']+= "Value of key 'value' (" + location_of_object_in_yaml_file + " -> value ) is not in a datetime format\n"

            if 'precision' in statement:
                if not isinstance(statement['precision'], int):
                    errors['ErrorInYAMLFileException']+= "Value of key 'precision' (" + location_of_object_in_yaml_file + " -> precision ) should be an integer\n"
                else:
                    if statement['precision'] > 14 or statement['precision'] < 0:
                        errors['ConstraintViolationErrorException']+= "Value of key 'precision' (" + location_of_object_in_yaml_file + " -> precision ) should be an integer between [0,14]\n"

            else:
                errors['ErrorInYAMLFileException']+= "Key 'precision' (" + location_of_object_in_yaml_file + " -> X) not found\n"

            if 'calendar' in statement:
                if isinstance(statement['calendar'], str):
                    if statement['calendar'] != "Q1985727" and statement['calendar'] != "Q1985786":
                        errors['ErrorInYAMLFileException']+= "Value of key 'calendar' (" + location_of_object_in_yaml_file + " -> value ) should be 'Q1985727' or 'Q1985786'\n"
                else:
                    errors['ErrorInYAMLFileException']+= "Value of key 'calendar' (" + location_of_object_in_yaml_file + " -> value ) should be 'Q1985727' or 'Q1985786'\n"
            else:
                errors['ErrorInYAMLFileException']+= "Key 'calendar' (" + location_of_object_in_yaml_file + " -> X) not found\n"

            if 'time_zone' in statement:
                try:
                    value = int(statement['time_zone'])
                    if value > 14 or value < -12:
                        errors['ConstraintViolationErrorException']+= "Value of key 'time_zone' (" + location_of_object_in_yaml_file + " -> time_zone ) should be an integer between [-12.14]\n"
                except ValueError:
                    errors['ConstraintViolationErrorException']+= "Value of key 'time_zone' (" + location_of_object_in_yaml_file + " -> time_zone ) should be an integer between [-12.14]\n"
            else:
                errors['ErrorInYAMLFileException']+= "Key 'time_zone' (" + location_of_object_in_yaml_file + " -> X) not found\n"
        # elif property_type == "Url":
        #     TODO
        # elif property_type == "Monolingualtext":
        #     TODO
    return errors

def check_for_valid_keys(valid_keys: set, object: dict, location_of_object_in_yaml_file: str) -> str:
    errors = ""
    for key in object.keys():
        if key not in valid_keys:
            errors+="Unrecognized key '" + key + "' (" + location_of_object_in_yaml_file + " -> " + key + ") found\n"
    return errors

def validate_yaml_parameters_based_on_property_type(object: dict, location_of_object_in_yaml_file: str,
                                                    sparql_endpoint: str, is_checking_for_qualifier: bool) -> dict:
    template_property = str(object['property'])
    errors = ""
    # if template_property in property_type_map:
    #     property_type = property_type_map[template_property]
    # else:
    property_type = get_property_type(template_property, sparql_endpoint)
        # property_type_map[template_property] = property_type
    if property_type == 'Time':
        if is_checking_for_qualifier:
            valid_keys = {'property', 'value', 'calendar', 'precision', 'time_zone', 'format', 'unit', 'cell'}
        else:
            valid_keys = {'property', 'value', 'calendar', 'precision', 'time_zone', 'format', 'item', 'qualifier',
                          'unit', 'cell'}
        error = check_for_valid_keys(valid_keys, object, location_of_object_in_yaml_file)
        if error:
            errors += error
        if 'calendar' not in object:
            errors+= "Key 'calendar' not found (" + location_of_object_in_yaml_file + " -> calendar)\n"
        else:
            if not object['calendar'] or not isinstance(object['calendar'], str):
                errors+= "Value of  key 'calendar' (" + location_of_object_in_yaml_file + " -> calendar) must be a string\n"

        if 'precision' not in object:
            errors+= "Key 'precision' not found (" + location_of_object_in_yaml_file + " -> precision)\n"
        else:
            if not object['precision'] or not isinstance(object['precision'], (str, int)):
                errors+= "Value of  key 'precision' (" + location_of_object_in_yaml_file + " -> precision) must be a string or an integer\n"

        if 'time_zone' not in object:
            errors+= "Key 'time_zone' not found (" + location_of_object_in_yaml_file + " -> time_zone)\n"
        else:
            if object['time_zone'] is None or not str(object['time_zone']).isdigit() or not isinstance(object['format'], (str, int)):
                errors+= "Value of  key 'time_zone' (" + location_of_object_in_yaml_file + " -> time_zone) must be an integer\n"

        if 'format' not in object:
            errors+= "Key 'format' not found (" + location_of_object_in_yaml_file + " -> format)\n"
        else:
            if not object['format'] or not isinstance(object['format'], str):
                errors+= "Value of  key 'format' (" + location_of_object_in_yaml_file + " -> format) must be a string\n"

    elif property_type == 'Monolingualtext':
        if is_checking_for_qualifier:
            valid_keys = {'property', 'value', 'lang', 'unit', 'cell'}
        else:
            valid_keys = {'property', 'value', 'lang', 'item', 'qualifier', 'unit', 'cell'}
        error = check_for_valid_keys(valid_keys, object, location_of_object_in_yaml_file)
        if error:
            errors += error

        if 'lang' not in object:
            errors+= "Key 'lang' not found (" + location_of_object_in_yaml_file + " -> lang)"
        else:
            if not object['lang'] or not isinstance(object['lang'], str):
                errors+= "Value of  key 'lang' (" + location_of_object_in_yaml_file + " -> format) must be a lang\n"

    elif property_type == 'GlobeCoordinate':
        if is_checking_for_qualifier:
            valid_keys = {'property', 'latitude', 'longitude', 'precision', 'unit', 'cell'}
        else:
            valid_keys = {'property', 'latitude', 'longitude', 'precision', 'item', 'qualifier', 'unit', 'cell'}
        error = check_for_valid_keys(valid_keys, object, location_of_object_in_yaml_file)
        if error:
            errors += error

        if 'latitude' not in object:
            errors+= "Key 'latitude' not found (" + location_of_object_in_yaml_file + " -> latitude)\n"
        else:
            if not object['latitude'] or not isinstance(object['latitude'], (str, int)):
                errors+= "Value of  key 'latitude' (" + location_of_object_in_yaml_file + " -> latitude) must be a string or an integer\n"

        if 'longitude' not in object:
            errors+= "Key 'longitude' not found (" + location_of_object_in_yaml_file + " -> longitude)\n"
        else:
            if not object['longitude'] or not isinstance(object['longitude'], (str, int)):
                errors+= "Value of  key 'longitude' (" + location_of_object_in_yaml_file + " -> longitude) must be a string or an integer\n"

        if 'precision' not in object:
            errors+= "Key 'precision' not found (" + location_of_object_in_yaml_file + " -> precision)\n"
        else:
            if not object['precision'] or not isinstance(object['precision'], (str, int)):
                errors+= "Value of  key 'precision' (" + location_of_object_in_yaml_file + " -> precision) must be a string or an integer\n"

    elif property_type == "Property Not Found":
        errors+= "Value of  key 'property' (" + location_of_object_in_yaml_file + " -> property) must be a valid item\n"
    else:
        if is_checking_for_qualifier:
            valid_keys = {'property', 'value', 'unit', 'cell'}
        else:
            valid_keys = {'property', 'value', 'item', 'qualifier', 'unit', 'cell'}
        error = check_for_valid_keys(valid_keys, object, location_of_object_in_yaml_file)
        if error:
            errors += error

    categorized_error = {'ErrorInYAMLFileException': errors}
    return categorized_error

def json_statement_validator(statements: list, sparql_endpoint: str):
    errors = dict()
    item_existence_map = dict()
    verified_statements = list()
    for index, statement in enumerate(statements):
        cell = statement['cell']
        categorized_error = defaultdict(str)
        categorized_warning = defaultdict(str)
        if 'item' in statement['statement']:
            item = statement['statement']['item']
            error = validate_item(item, sparql_endpoint, item_existence_map)
            if error:
                categorized_warning['ItemNotFoundException']+= error
            if 'property' in statement['statement']:
                location_of_object_in_yaml_file = "statement"
                is_checking_for_qualifier = False
                error = validate_yaml_parameters_based_on_property_type(statement['statement'], location_of_object_in_yaml_file,
                                                sparql_endpoint, is_checking_for_qualifier)
                error = get_non_empty_dict(error)
                if error:
                    categorized_error = merge_dicts(categorized_error, error)
                else:
                    error = validate_value(statement['statement'], location_of_object_in_yaml_file, sparql_endpoint)
                    error = get_non_empty_dict(error)
                    if error:
                        categorized_error = merge_dicts(categorized_error, error)
                    else:
                        if 'qualifier' in statement['statement']:
                            for index, qualifier in enumerate(statement['statement']['qualifier']):
                                location_of_object_in_yaml_file = "statement -> qualifier[" + str(index) + "]"
                                is_checking_for_qualifier = True
                                error = validate_yaml_parameters_based_on_property_type(qualifier,
                                                                                        location_of_object_in_yaml_file,
                                                                                        sparql_endpoint,
                                                                                        is_checking_for_qualifier)
                                error = get_non_empty_dict(error)
                                if error:
                                    categorized_error = merge_dicts(categorized_error, error)
                                else:
                                    error = validate_value(qualifier, location_of_object_in_yaml_file, sparql_endpoint)
                                    error = get_non_empty_dict(error)
                                    if error:
                                        categorized_error = merge_dicts(categorized_error, error)
            else:
                categorized_error["ErrorInYAMLFileException"]+= "Key 'property' (statementMapping -> template -> X) not found\n"
        else:
            categorized_error["ErrorInYAMLFileException"]+= "Key 'item' (statementMapping -> template -> X) not found\n"
        if categorized_error or categorized_warning:
            errors[cell] = list()
            errors[cell] += categorized_error_to_error_list(categorized_error, is_warning=False)
            errors[cell] += categorized_error_to_error_list(categorized_warning, is_warning=True)
        else:
            verified_statements.append(statement)
        # if not errors[cell]:
        #     del errors[cell]
        #     verified_statements.append(statement)
    return errors, verified_statements