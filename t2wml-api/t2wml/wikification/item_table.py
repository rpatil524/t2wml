import json
import pandas as pd
from collections import defaultdict
from t2wml.spreadsheets.conversions import to_excel
from t2wml.utils.t2wml_exceptions import ItemNotFoundException
from t2wml.utils.bindings import bindings




class ItemTable:
    def __init__(self, lookup_table={}):
        self.lookup_table=defaultdict(dict, lookup_table)

    def lookup_func(self, lookup, column, row, value):
        #order of priority: cell+value> cell> col+value> col> row+value> row> value
        tuples=[
            (column, row, value),
            (column, row, ''),
            (column, '', value),
            (column, '', ''),
            ('', row, value),
            ('', row, ''),
            ('', '', value)
        ]

        for tup in tuples:
            item=lookup.get(str(tup))
            if item:
                return item
        
        raise ValueError("Not found")

    def get_item(self, column, row, context=''):
        lookup=self.lookup_table.get(context)
        if not lookup:
            raise ItemNotFoundException("No values defined for context: {}".format(context))
        value=bindings.excel_sheet[row, column]
        try:
            item= self.lookup_func(lookup, column, row, value)
            return item
        except ValueError:
            return None #currently this is what the rest of the API expects. could change later
        #   raise ItemNotFoundException("Item for cell "+to_excel(column, row)+"("+value+")"+"with context "+context+" not found")

    def get_item_by_string(self, value, context=''):
        lookup=self.lookup_table.get(context)
        if not lookup:
            raise ItemNotFoundException("No values defined for context: {}".format(context))

        item=lookup.get(str(('', '', value)))
        if item:
            return item
        raise ItemNotFoundException("Could not find item for value: "+value)

    def serialize(self):
        return {
            "lookup_table":self.lookup_table
        }
    def save_to_file(self, file_path):
        output=json.dumps(self.serialize())
        with open(file_path, 'w') as f:
            f.write(output)

    @classmethod
    def load_from_file(cls, file_path):
        with open(file_path, 'r') as f:
            args=json.load(f)
        return cls(**args)

    def update_table_from_dataframe(self, df):
        df=df.fillna('')
        df=df.replace(r'^\s+$', '', regex=True)
        overwritten={}
        for entry in df.itertuples():
            column=entry.column
            row=entry.row
            value=entry.value
            context=entry.context
            item=entry.item

            if not item:
                raise ValueError("Item definition missing")
            
            key=str((column, row, value))
            if self.lookup_table[context].get(key):
                overwritten[key]=self.lookup_table[context][key]
            self.lookup_table[context][key]=item

        if len(overwritten):
            print("Wikifier update overwrote existing values: "+str(overwritten))
        return overwritten
            

class Wikifier:
    def __init__(self):
        self.wiki_files=[]
        self.non_file_df_count=0
        self._data_frames=[]
        self._item_table=ItemTable()

    @property
    def print_data(self):
        print("The wikifier contains {} wiki files as well as {} non-file dataframes".format(len(self.wiki_files), self.non_file_df_count))
        if len(self.wiki_files):
            print("The files are:")
            for filename in self.wiki_files:
                print(filename)
    
    @property
    def item_table(self):
        return self._item_table

    def add_file(self, file_path):
        df=pd.read_csv(file_path)
        try:
            overwritten=self.item_table.update_table_from_dataframe(df)
        except:
            raise ValueError("Could not apply {}".format(file_path))
        self.wiki_files.append(file_path)
        self._data_frames.append(df)
        return overwritten
        

    def add_dataframe(self, df):
        expected_columns=set(['row', 'column', 'value', 'context', 'item'])
        columns=set(df.columns)
        missing_columns=expected_columns.difference(columns)
        if len(missing_columns):
            raise ValueError("Dataframe for wikifier must contain all 5 expected columns")
        try:
            overwritten=self.item_table.update_table_from_dataframe(df)
        except Exception as e:
            raise ValueError("Could not apply dataframe: "+str(e))
        self.non_file_df_count+=1
        self._data_frames.append(df)
        return overwritten
    
    def save(self, filename):
        output=json.dumps({
            "wiki_files":self.wiki_files,
            "df_count":self.non_file_df_count,
            "item_table":self.item_table.serialize()
        })
        with open(filename, 'w') as f:
            f.write(output)

    @classmethod
    def load(cls, filename):
        with open(filename, 'r') as f:
            wiki_args=json.load(f)
        wikifier=Wikifier()
        wikifier.wiki_files=wiki_args["wiki_files"]
        wikifier.non_file_df_count=wiki_args["df_count"]
        wikifier.item_table=ItemTable(**wiki_args["item_table"])
        return wikifier



