import boto3
import os
from src.helperFunctions import getReturnArray
from botocore.config import Config
from dotenv import load_dotenv


def validateEnvCredentials():
    """
      Loads & Validates AWS credentials from environment variables.
      ARGS
          None
      RETURN
          Return returnArray -> data (dictionary): credentials
    """
    try:
      # Load environment variables from .env file
      load_dotenv()  
      #Fetching AWS credentials from environment variables
      credentials = {'AWS_ACCESS_KEY_ID': os.getenv("AWS_ACCESS_KEY_ID"),
                           'AWS_SECRET_ACCESS_KEY': os.getenv("AWS_SECRET_ACCESS_KEY"),
                           'AWS_DEFAULT_REGION': os.getenv("AWS_DEFAULT_REGION"),
                           'AWS_S3_BUCKET': os.getenv("AWS_S3_BUCKET")
                          }


      # Check if all required credentials are present    
      for key, value in credentials.items():
        if not value:
          return getReturnArray(False, 'Failed to fetch ' + key +' environment variable', None)
      return getReturnArray(True, '', credentials)
    except Exception as e:
      return getReturnArray(False, f'Failed to fetch environment variables: {e}', None)

try:
    s3 = None
    bucketName = None
    s3Config = validateEnvCredentials()
    if not s3Config['status']:
        print(getReturnArray(False, "[S3 INIT] .env credentials not found "+ s3Config['message'], None))
    config = Config(
        region_name=s3Config['data'][0]['AWS_DEFAULT_REGION'],
        retries={
            'max_attempts': 10,
            'mode': 'adaptive'
        },
        max_pool_connections=50,
        connect_timeout=60,
        read_timeout=60
    )
    #initializing the s3 client
    s3 = boto3.client(
        "s3",
        aws_access_key_id=s3Config['data'][0]['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=s3Config['data'][0]['AWS_SECRET_ACCESS_KEY'],
        config=config
    )
    bucketName = s3Config['data'][0]['AWS_S3_BUCKET']
    print(getReturnArray(True, "[S3 INIT] S3 client initialized successfully", ''))

except Exception as e:
    print(getReturnArray(False, f"[S3 INIT] Error initializing S3: {e}", None))
    s3 = None
    bucketName = None




def fetchS3Files(localDir):
    """
      Fetches S3 files from the bucket and saves to local directory.
      ARGS
          None
      RETURN
          Return returnArray -> status (boolean): True/False.
    """
    try:
      # List objects in the bucket
      response = s3.list_objects_v2(Bucket=bucketName)

      if 'Contents' not in response:
          return getReturnArray(False, "No files found in the bucket", None)

      for obj in response['Contents']:
          key = obj['Key']
          if key.endswith('/'):
              continue  # skip folders
          s3.download_file(bucketName, key, localDir + '/' +key.split('/')[-1] )
      return getReturnArray(True, "", "")

    except Exception as e:
        return getReturnArray(False, f"Error fetching files from S3: {e}", None)