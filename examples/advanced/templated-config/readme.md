# Templated Configuration

FireLens Datajet's executor uses [Mustache Templating Engine](https://mustache.github.io/) to parse your configuration files before executing Fluent Bit with the parsed configuration.

Template variable definitions can be added anywhere in the FireLens datajet schema surrounding the Executor or within the executor.

For Example FireLens Datajet Executor:
```
{
    "component": "fluent-bit-executor",
    "definitions": {
        "cloudwatch_group_name": "PR_1_1_datajet_minimal_synchronous_scheduler_1_9_4out_1worker",
        "stream": [
          { "name": "TCP_A", "port": "6270" },
          { "name": "TCP_B", "port": "6271" },
          { "name": "TCP_C", "port": "6272" },
          { "name": "TCP_D", "port": "6273" }
        ],
        "workers": "1"
    },
    "config": {
       "fluentConfigFile": "./data/data-public/fluent-config/fluent-bit-tcp-cloudwatch-Xout-Xworker.conf",
       (,,,)
    },
    "child": {
        "component": "synchronizer",
        (...)
    }
  }
```

Along with the templated Fluent Bit configuration file which is referenced:
```
[SERVICE]
     # See:
     # https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_firelens.html
     # https://github.com/aws-samples/amazon-ecs-firelens-under-the-hood/tree/master/generated-configs/fluent-bit
     Flush        10
     Grace        30
     Log_Level    info
     HTTP_Server  On
     HTTP_Listen  0.0.0.0
     HTTP_PORT    2020
     storage.metrics On
{{#defined.stream}}
[INPUT]
     Name        tcp
     Tag         {{name}}
     Listen      0.0.0.0
     Port        {{port}}
     Format      json
{{/defined.stream}}
{{#defined.stream}}
[OUTPUT]
     Name cloudwatch_logs
     Match {{name}}
     log_stream_prefix {{name}}
     log_group_name {{defined.cloudwatch_group_name}}
     auto_create_group true
     region us-west-2
     log_key log
     net.keepalive      off
     workers {{defined.workers}}
{{/defined.stream}}
```

Results in the following parsed configuration file which appears in the output folder.

```
[SERVICE]
     # See:
     # https://docs.aws.amazon.com/AmazonECS/latest/developerguide/using_firelens.html
     # https://github.com/aws-samples/amazon-ecs-firelens-under-the-hood/tree/master/generated-configs/fluent-bit
     Flush        10
     Grace        30
     Log_Level    info
     HTTP_Server  On
     HTTP_Listen  0.0.0.0
     HTTP_PORT    2020
     storage.metrics On
[INPUT]
     Name        tcp
     Tag         TCP_A
     Listen      0.0.0.0
     Port        6270
     Format      json
[INPUT]
     Name        tcp
     Tag         TCP_B
     Listen      0.0.0.0
     Port        6271
     Format      json
[INPUT]
     Name        tcp
     Tag         TCP_C
     Listen      0.0.0.0
     Port        6272
     Format      json
[INPUT]
     Name        tcp
     Tag         TCP_D
     Listen      0.0.0.0
     Port        6273
     Format      json
[OUTPUT]
     Name cloudwatch_logs
     Match TCP_A
     log_stream_prefix TCP_A
     log_group_name PR_1_1_datajet_minimal_synchronous_scheduler_1_9_4out_1worker
     auto_create_group true
     region us-west-2
     log_key log
     net.keepalive      off
     workers 1
[OUTPUT]
     Name cloudwatch_logs
     Match TCP_B
     log_stream_prefix TCP_B
     log_group_name PR_1_1_datajet_minimal_synchronous_scheduler_1_9_4out_1worker
     auto_create_group true
     region us-west-2
     log_key log
     net.keepalive      off
     workers 1
[OUTPUT]
     Name cloudwatch_logs
     Match TCP_C
     log_stream_prefix TCP_C
     log_group_name PR_1_1_datajet_minimal_synchronous_scheduler_1_9_4out_1worker
     auto_create_group true
     region us-west-2
     log_key log
     net.keepalive      off
     workers 1
[OUTPUT]
     Name cloudwatch_logs
     Match TCP_D
     log_stream_prefix TCP_D
     log_group_name PR_1_1_datajet_minimal_synchronous_scheduler_1_9_4out_1worker
     auto_create_group true
     region us-west-2
     log_key log
     net.keepalive      off
     workers 1
```


This allows for a set of Datajet tests to rely on the same Fluent Bit configuation file template.

