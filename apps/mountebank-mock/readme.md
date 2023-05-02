## Mountebank Mock API Instructions

This is a prototype of a mock CloudWatch API server via Mountebank. See the configuration file for the mock in mountebank.json

To run a test, run the mock mountebank CloudWatch API server via:
```
bash ./examples/mocks/mountebank/start_cloudwatch_mock.sh 
```

Then start your Fluent Bit tests.

Fluent Bit CloudWatch will need to be configured with the following settings:

```
[OUTPUT]
     Name cloudwatch_logs
     Match dummy
     log_stream_prefix TCP_A_3
     log_group_name segfault_tcp_cloudwatch_3
     auto_create_group true
     region us-west-2
     workers 1
     tls.verify false
     port 4545
     endpoint 127.0.0.1
```

Notably the following are set:
```
     tls.verify false
     port 4545
     endpoint 127.0.0.1
```

These options are enabled by the following cherrypicked commit:
```
https://github.com/matthewfala/fluent-bit.git immutable-cwl-net-options 5d9692f00b5295728bf0340d332896a7cc450a7e
```
