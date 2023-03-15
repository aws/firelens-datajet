# Mountebank Stubs
Mountebank operates on mock request definitions called stubs. Below is a documentation of various stubs that can be used to mock the CloudWatch API.

## How to configure the mock API via stubs
```
curl -i -X POST -H 'Content-Type: application/json' http://localhost:2525/imposters --data '{
  "port": 4545,
  "protocol": "https",
  "stubs": [
    {stub 1},
    {stub 2},
    {stub 3}
  ]
}'
```

## Stub: Put Log Events
```
{
  "responses": [
    {
      "is": { "statusCode": 200 },
      "headers": {
        "x-amzn-RequestId": "d35a6920-52e1-4f3a-bf8f-46016f474463",
        "Connection": "keep-alive",
        "Content-Type": "application/x-amz-json-1.1",
        "Content-Length": 80,
        "Date": "Mon, 13 Mar 2023 23:09:24 GMT",
        "Keep-Alive": "timeout=5"
      },
      "body": "{\"nextSequenceToken\":\"49637338213634440402126044667090232594261646769605574882\"}"
    }
  ],
  "predicates": [{
    "and": [
      {
        "equals": {
          "path": "/",
          "method": "POST",
          "headers": {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Logs_20140328.PutLogEvents"
          }
        }
      }
    ]
  }]
}
```

## Stub: Create Log Stream
```
{
  "responses": [
    {
      "is": { "statusCode": 200 },
      "headers": {
        "x-amzn-RequestId": "d35a6920-52e1-4f3a-bf8f-46016f474463",
        "Connection": "keep-alive",
        "Content-Type": "application/x-amz-json-1.1",
        "Content-Length": 0,
        "Date": "Mon, 13 Mar 2023 23:09:24 GMT",
        "Keep-Alive": "timeout=5"
      }
    }
  ],
  "predicates": [{
    "and": [
      {
        "equals": {
          "path": "/",
          "method": "POST",
          "headers": {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Logs_20140328.CreateLogStream"
          }
        }
      }
    ]
  }]
}
```

## Stub: Create Log Group
```
{
  "responses": [
    {
      "is": {
        "statusCode": 200,
        "headers": {
          "x-amzn-RequestId": "d35a6920-52e1-4f3a-bf8f-46016f474463",
          "Connection": "keep-alive",
          "Content-Type": "application/x-amz-json-1.1",
          "Content-Length": 0,
          "Date": "Mon, 13 Mar 2023 23:09:24 GMT",
          "Keep-Alive": "timeout=5"
        }
      }
    }
  ],
  "predicates": [{
    "and": [
      {
        "equals": {
          "path": "/",
          "method": "POST",
          "headers": {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Logs_20140328.CreateLogGroup"
          }
        }
      }
    ]
  }]
}
```

## Stub: Describe Log Groups
```
{
  "responses": [
    {
      "is": {
        "statusCode": 200,
        "headers": {
          "x-amzn-RequestId": "d35a6920-52e1-4f3a-bf8f-46016f474463",
          "Connection": "keep-alive",
          "Content-Type": "application/x-amz-json-1.1",
          "Content-Length": 0,
          "Date": "Mon, 13 Mar 2023 23:09:24 GMT",
          "Keep-Alive": "timeout=5"
        },
        "body": {
          {
            "logGroups": [
              {
                "arn": "arn:aws:logs:us-east-1:123456789012:log-group:monitoring-logGroup-1234:*",
                "creationTime": 1393545600000,
                "logGroupName": "monitoring-logGroup-1234"
              }
            ]
          }
        }
      }
    }
  ],
  "predicates": [{
    "and": [
      {
        "equals": {
          "path": "/",
          "method": "POST",
          "headers": {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Logs_20140328.DescribeLogGroups"
          }
        }
      }
    ]
  }]
}
```

## Stub: Put Log Events with Ocasional Exceptions
```
{
  "predicates": [{
    "and": [
      {
        "equals": {
          "path": "/",
          "method": "POST",
          "headers": {
            "Content-Type": "application/x-amz-json-1.1",
            "X-Amz-Target": "Logs_20140328.PutLogEvents",
            "Connection": "keep-alive",
            "Keep-Alive": "timeout=5",
            "Content-Type": "application/x-amz-json-1.1",
          }
        }
      }
    ]
  }],
  "responses": [
    {
      "is": {
        "statusCode": 200,
        "headers": {
          "x-amzn-RequestId": "d35a6920-52e1-4f3a-bf8f-46016f474463",
          "Connection": "keep-alive",
          "Keep-Alive": "timeout=5",
          "Content-Type": "application/x-amz-json-1.1",
          "Content-Length": "80"
        },
        "body": "{\"nextSequenceToken\":\"49637338213634440402126044667090232594261646769605574882\"}",
        "repeat": 5
      }
    },
    {
      "is": {
        "statusCode": 400,
        "body": {
          "__type": "ServiceUnavailableException",
          "message": "The service cannot complete the request."
        }
      }
    }
  ]
}
```
