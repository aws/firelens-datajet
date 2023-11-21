
echo "Mountebank API Mocker with S3 Client v0.0.1"

# Retrieve S3 Test Configuration
aws s3 cp s3://${CLIENT_S3_BUCKET}/${CLIENT_S3_FILE} ./mountebank.json

# Launch Mountebank
(mb --nologfile)&
child=$!

sleep 5

# Load Configuration
config=`cat /mountebank.json`
echo $config
curl -i -X POST -H 'Content-Type: application/json' http://localhost:2525/imposters --data "$config"

# Wait for Mountebank
wait "$child"
