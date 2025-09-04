"""Generic helper functions that are used across s2i Turbokit"""

import re 
import json
import os
import shutil
from dotenv import load_dotenv


def getS2iPath():
    """
    Get the root folder for s2i Turbokit. 
    If the environmant variable is not set then assuming current folder.
    """
    load_dotenv()
    s2iPath = os.getenv("s2iROOTPATH", os.getcwd()) + "/s2iTurbokit"

    return s2iPath


def getS2iRoot():
    """
    Get the root folder for s2i. 
    If the environmant variable is not set then assuming current folder
    """
    load_dotenv()
    s2iPath = os.getenv("s2iROOTPATH", os.getcwd())

    return s2iPath


def getReturnArray(status, message, data):
    '''
        Given a status, message, and data, format into returnArray structure.
    ARGS
        status (bool): Whether the operation succeeded (True) or failed (False).
        message (string): Message to attach.
        data (any): Data to return.
    RETURN 
        Returns the data as a returnArray.
    '''
    if type(data) is not list:
        data = [data]
    returnArray = {
        "status": status,
        "message": message,
        "data": data
    }
    return returnArray

def getDomainName(url):
    '''
        Extract the domain name from any given URL and return the name as string
        getDomainName("https://www.example.com/path/to/page") will return 'example.com'
        getDomainName("http://sub.example.co.uk/some-page") will return sub.example.co.uk
        Return domain | 'None'
    ARGS
        url (string): URL to extract the domain name from.
    RETURN
        Return returnArray -> data: domain to return
    '''
    # Define a regular expression pattern for extracting the domain
    pattern = r"(https?://)?(www\d?\.)?(?P<domain>[\w\.-]+\.\w+)(/\S*)?"

    # Use re.match to search for the pattern at the beginning of the URL
    match = re.match(pattern, url)

    # Check if a match is found
    if match:
        # Extract the domain from the named group "domain"  
        domain = match.group("domain")
        returnArray = getReturnArray(True, '', domain)
    else:
        returnArray = getReturnArray(False, f'Unable to extract domain from {url}', None)
    return returnArray

def loadJSON(jsonPath):
    '''
        Given a path to a json file, loads json file.
    ARGS
        jsonPath (string): Path to json file to load.
    RETURN
        Returns jsonData (dictionary). 
    '''
    with open(jsonPath, 'r', encoding='utf-8') as f:
        jsonData = json.load(f)
    return jsonData

def writeJSON(data, outPath):
    '''
        Given data and an outPath, writes data as a json file to outPath.
    ARGS
        data (dictionary|list): Data to be written to json.
        outPath (string): Path to write json file to.
    RETURN
        Return returnArray -> data: None. File will be written to disk.
    '''
    try:
        import tempfile
        import shutil
        
        # Write to a temporary file first, then atomically move it
        temp_path = outPath + '.tmp'
        with open(temp_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=4)
        
        # Atomic move (rename) to final destination
        shutil.move(temp_path, outPath)
        returnArray = getReturnArray(True, f'Data written to {outPath}', '')
    except Exception as e:
        returnArray = getReturnArray(False, e, '')
    return returnArray

def getPrompt(instruction, query, context):
    '''
        Given 3 strings, (instruction, query, context), concat together to format complete prompt.
    ARGS
        instruction (string): Instruction for the model.
        query (string): Query for the model.
        context (string): Context for the model.
    RETURN
        Returns prompt. No need for returnArray, should never fail.
    '''
    p = f'{instruction}\n{query}'
    prompt = f'{p}\n{context}'
    
    return prompt

def unpackDict2Str(dictionary):
    '''
        Given a dictionary, translate it to a string.
    ARGS
        dict (dictionary): Dictionary to convert to string.
    RETURN
        Return returnArray -> data: finalString
    '''
    array2str = []
    try:
        for key in dictionary:
            value = dictionary[key]
            stringKey = str(key)
            stringVal = str(value)
            fString = f'{stringKey}:{stringVal},'
            array2str.append(fString)
        finalString = "\n".join(array2str)
        finalString = re.sub("^\\[", '', finalString)
        finalString = re.sub("\\]$", '', finalString)
        returnArray = getReturnArray(True, '', finalString)
    except Exception as e:
        returnArray = getReturnArray(False, e, None)
    return returnArray

def unpackFileName(filePath):
    '''
        Given a file path, get the name of the file.
    ARGS
        filePath (string): File path to extract file name from.
    RETURN
        Return returnArray -> data: fileName
    '''
    try:
        if filePath.count("\\") > 0:
            f = filePath.rsplit("\\")
            fileName = f[-1]
            returnArray = getReturnArray(True, '', fileName)
        elif filePath.count("/") > 0:
            f = filePath.rsplit("/")
            fileName = f[-1]
            returnArray = getReturnArray(True, '', fileName)
        else:
            returnArray = getReturnArray(False, f'The file path {filePath} is not invalid!', None)
    except Exception as e:
        returnArray = getReturnArray(False, e, None)

    return returnArray

def checkDirectory(directory):
    '''
        Checks if the given path exists. If not, creates path.
    ARGS
        directory (string): Path to check.
    RETURN 
        Returns returnArray -> data: returns path created.
    '''
    try:
        if os.path.exists(directory):
            shutil.rmtree(directory)
        os.makedirs(directory)

        returnArray = getReturnArray(True, '', directory)
    except Exception as e:
        returnArray = getReturnArray(False, e, '')
    return returnArray

def checkPath(path):
    '''
        Checks if the given path exists. If not, creates path.
    ARGS
        path (string): File or Directory path to check.
    RETURN 
        Returns returnArray -> status:True/False, data: path if exists, else None.
    '''
    try:
        if os.path.exists(path):
            return getReturnArray(True, '', path)
        return getReturnArray(False, f'The path {path} does not exist!', None)
    except Exception as e:
        return getReturnArray(False, e, None)


def getDictfromKeys(keyList):
    '''
        Returns a dictionary with keys from the passed keyList.
    ARGS
        keyList (list of string): List of keys to initialize dictionary with.
    RETURN
        Returns returnArray -> data: returns dictionary created.
    '''
    try:
        dictionary = dict.fromkeys(keyList)
        returnArray = getReturnArray(True, '', dictionary)
    except Exception as e:
        returnArray = getReturnArray(False, e, None)

    return returnArray