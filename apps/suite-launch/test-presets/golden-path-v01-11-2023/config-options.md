# Configuration Options
- ServiceName: String, used in log groups
- cw_use_mock: true or false, true, makes use of cloudwatch mock. Note you must have the following cherrypick to make use of this feature
    - https://github.com/matthewfala/fluent-bit.git immutable-cwl-net-options 5d9692f00b5295728bf0340d332896a7cc450a7e
- include_onepod: true or false, true, adds onepod configuration
- add_forward: true or false, true, adds a forward plugin to recieve forwarded logs

- kbps_throughput_tcp, number, 100, throughput to tcp in kb per seconds
- kbps_throughput_tail, number, 40, throughput to tail in kb per seconds
- kbps_forward, number, 4, throughput to forward in kb per seconds

