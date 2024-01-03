-------------------------------------------------------------------------------
-- Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
-- SPDX-License-Identifier: Apache-2.0
-------------------------------------------------------------------------------

-------------------------------------------------------------------------------
-- AWS for Fluent Bit Monitoring Lua Script
--
-- Add the following blocks to Fluent Bit configuration for EMF Monitoring:
--
--[[
[SERVICE]
  # Add the following to Service Configuration
  HTTP_Server  On
  HTTP_Listen  0.0.0.0
  HTTP_PORT    2020
  STORAGE.METRICS On

# Configure FB to scrape its metrics
[INPUT]
  Name exec
  Command echo "{\"flb_metrics\":$(curl -s http://127.0.0.1:2020/api/v1/metrics),\"storage\":$(curl -s http://127.0.0.1:2020/api/v1/storage)}"
  Interval_Sec 1
  Tag flb_metrics

[FILTER]
  Name lua
  Match flb_metrics
  Script <path-to-script>/aws-for-fluent-bit-monitoring-metrics_1_0_0.lua
  Call to_emf

[OUTPUT]
  Name cloudwatch_logs
  log_format json/emf
  Match flb_metrics
  log_stream_prefix ${HOSTNAME}
  log_group_name fluent-bit-metrics-emf
  auto_create_group true
  region <region>
--]]
-------------------------------------------------------------------------------

local json = { _version = "0.1.2" }

-------------------------------------------------------------------------------
-- Constants
-------------------------------------------------------------------------------
-- Defaults
local DEFAULT_WINDOW=-1
local DEFAULT_RATE_WINDOW_SIZE=300  -- 5 minutes
local DEFAULT_STORAGE_RESOLUTION=60 -- 1 minute
local DEFAULT_NAMESPACE="AWSForFluentBit/Monitoring"
local DEFAULT_METRICS={}
local DEFAULT_PROPERTIES={}
local DEFAULT_DIMENSIONS={{}}
local DEFAULT_ADDED_DIMENSIONS={"Alias", "PluginType"}
local RATE_SUFFIX="_per_second"
local CONFIGURATION={}

local DEFAULT_WINDOW_OVERRIDES={
  retries=DEFAULT_RATE_WINDOW_SIZE,
  dropped_records=DEFAULT_RATE_WINDOW_SIZE,
  errors=DEFAULT_RATE_WINDOW_SIZE,
  retried_records=DEFAULT_RATE_WINDOW_SIZE,
  proc_records=DEFAULT_RATE_WINDOW_SIZE,
  retries_failed=DEFAULT_RATE_WINDOW_SIZE,
  proc_bytes=DEFAULT_RATE_WINDOW_SIZE,
  records=DEFAULT_RATE_WINDOW_SIZE,
  bytes=DEFAULT_RATE_WINDOW_SIZE,
  add_records=DEFAULT_RATE_WINDOW_SIZE,
  drop_records=DEFAULT_RATE_WINDOW_SIZE
}

-- Reverse set default to 60 with the following
--[[local DEFAULT_WINDOW_OVERRIDES={
  disk_chunks_total=-1,
  disk_chunks_up=-1,
  disk_chunks_down=-1,
  disk_chunks_busy=-1,
  disk_chunks_busy_size=-1,
  disk_size_approximate=-1,
  memory_overlimit=-1,
  memory_size=-1,
  memory_limit=-1
}
--]]
-- Environment
local ENV_NAMESPACE="AWS_FLB_MONITORING_NAMESPACE"
local ENV_CONFIGURATION="AWS_FLB_MONITORING_CONFIGURATION"
local ENV_DIMENSIONS="AWS_FLB_MONITORING_DIMENSIONS"
local ENV_PROPERTIES="AWS_FLB_MONITORING_PROPERTIES"
local ENV_METRICS="AWS_FLB_MONITORING_METRICS"

-- Units
local UNIT_BYTES = {
  cumulative="Bytes",
  rate="Bytes/Second"
}

local UNIT_COUNT = {
  cumulative="Count",
  rate="Count/Second"
}

local UNIT_OVERRIDES = {
  proc_bytes=UNIT_BYTES,
  bytes=UNIT_BYTES,
  memory_size=UNIT_BYTES,
  memory_limit=UNIT_BYTES
}

local DEFAULT_UNIT=UNIT_COUNT
local SIZE_TO_BYTES_TABLE = {
  "b", "K", "M", "G", "T", "P", "E", "Z", "Y"
}

-------------------------------------------------------------------------------
-- Input Validation
-------------------------------------------------------------------------------
local function validation_error(str)
  print("[AWS_FLB_MONITORING] [ValidationError]: " .. str)
end

local function is_array(t)
  if type(t) ~= "table" then return false end
  local i = 0
  for _ in pairs(t) do
      i = i + 1
      if t[i] == nil then return false end
  end
  return true
end

local function verify_metric_config(p, c)
  local verify_map = {
    name="string",
    unit="string",
    rateWindow="number",
    storageResolution="number",
    remove="boolean",
    suffix="string"
  }

  if (next(c) ~= nil and is_array(c)) or type(c) ~= "table" then
    validation_error("'" .. p .. "' must be a JSON map")
    return false
  end

  if c["name"] == nil then
    validation_error("'" .. p .. ".name' is a required parameter")
    return false
  end

  for k, v in pairs(c) do
    local path = p .. "." .. k
    if (verify_map[k] == nil) then
      validation_error("'" .. p .. "' property is not valid.")
      return false
    end
    if type(v) ~= verify_map[k] then
      validation_error("'" .. p .. "' must be of type '" .. verify_map[k] .. "'")
      return false
    end
  end
  return true
end

local function verify_dimensionset(p, c)
  if not is_array(c) then
    validation_error("'" .. ENV_CONFIGURATION .. ".dimensions[" .. tostring(i) ..
                     "] must be an array")
    return false
  end
  for j, v in ipairs(c) do
    if type(v) ~= "string" then
      validation_error("'" .. ENV_CONFIGURATION .. ".dimensions[" .. tostring(i) .. "]["
                       .. tostring(j) .. "] must be a string")
      return false
    end
  end
  return true
end

local function verify_metrics(p, c)
  if not is_array(c) then
    validation_error("'" .. p .. "' must be an array")
    return false
  end
  for i, v in ipairs(c) do
    local path = p .. "[" .. tostring(i) .. "]"
    if not verify_metric_config(path, v) then return false end
  end
  return true
end

local function verify_properties(p, c)
  if (next(c) ~= nil and is_array(c)) or type(c) ~= "table" then
    validation_error("'" .. p .. "' must be a JSON map")
    return false
  end
  for k, v in pairs(c) do
    local path = p .. "[" .. tostring(k) .. "]"
    if type(k)~="string" then
      validation_error("'" .. path .. "' field must be a string field")
      return false
    end

    if type(v)~="string" and type(v) ~= "number" then
      validation_error("'" .. path .. "' must be a 'string' or 'number'")
      return false
    end
  end
  return true
end

local function verify_dimensions(p, c)
  if not is_array(c) then
    validation_error("'" .. p .. "' must be an array")
    return false
  end
  for i, v in ipairs(c) do
    if not verify_dimensionset(p .. "[" .. tostring(i) .. "]", v) then return false end
  end
  return true
end

local function verify_namespace(p, c)
  if (type(c) ~= "string") then
    validation_error("'" .. p .. "' must be a string")
  end
end

local function verify_configuration(path, configuration)
  if (next(configuration) ~= nil and is_array(configuration)) or
      type(configuration) ~= "table" then
    validation_error("'" .. path .. "' must be a JSON map")
    return false
  end
  local verify_map = {
    dimensions=verify_dimensions,
    properties=verify_properties,
    metrics=verify_metrics,
    namespace=verify_namespace
  }
  for k, v in pairs(configuration) do
    local p = path .. "." .. k
    if (verify_map[k] == nil) then
      validation_error("'" .. p .. "' property is not valid")
      return false
    end
    if (verify_map[k](p, v) == false) then return false end
  end
  return true
end

-------------------------------------------------------------------------------
-- Configuration Modifiers for Efficient Metric Processing
-------------------------------------------------------------------------------

local function update_dimensionsets(dimensionsets, addon_dimensions)
  for i,dimensionset in ipairs(dimensionsets) do
    for j,a in ipairs(addon_dimensions) do
      table.insert(dimensionsets[i], j, a)
    end
  end
end

local function update_metrics(config)
  local obj = {}
  for i, v in ipairs(config["metrics"]) do
    obj[v["name"]] = v
    obj[v["name"]]["name"] = nil
  end
  config["metrics"] = obj
end

-------------------------------------------------------------------------------
-- EMF Metric Generator
-------------------------------------------------------------------------------

-- Load and parse environment variables on startup
local function load_environment_configuration()
  -- Run once
  if next(CONFIGURATION) ~= nil then return end

  -- Load environment variables
  local namespace_str=os.getenv(ENV_NAMESPACE)
  local dimensions_str=os.getenv(ENV_DIMENSIONS)
  local properties_str=os.getenv(ENV_PROPERTIES)
  local metrics_str=os.getenv(ENV_METRICS)
  local parsed_dimensions, parsed_properties, parsed_metrics, ret
  if dimensions_str ~= nil then
    ret, parsed_dimensions=pcall(function() return json.decode(dimensions_str) end)
    if (not ret) then
      validation_error("Could not parse '" .. ENV_DIMENSIONS .. "'=" .. dimensions_str ..
                       ". Falling back to default: " .. json.encode(DEFAULT_DIMENSIONS))
      parsed_dimensions=DEFAULT_DIMENSIONS
    end
  end
  if properties_str ~= nil then
    ret, parsed_properties=pcall(function() return json.decode(properties_str) end)
    if (not ret) then
      validation_error("Could not parse '" .. ENV_PROPERTIES .. "'=" .. properties_str ..
                       ". Falling back to default: " .. json.encode(DEFAULT_PROPERTIES))
      parsed_properties=DEFAULT_PROPERTIES
    end
  end
  if metrics_str ~= nil then
    ret, parsed_metrics=pcall(function() return json.decode(metrics_str) end)
    if (not ret) then
      validation_error("Could not parse '" .. ENV_METRICS .. "'=" .. metrics_str ..
                       ". Falling back to default: " .. json.encode(DEFAULT_METRICS))
      parsed_metrics=DEFAULT_METRICS
    end
  end

  -- Check namespace_str
  if type(namespace_str) ~= "string" and namespace_str ~= nil then
    validation_error("Environment variable '" .. ENV_NAMESPACE .. "' " ..
                     "must be of type string")
    validation_error("Using default namespace " .. DEFAULT_NAMESPACE)
    namespace_str = nil
  end

  -- Create configuration object
  CONFIGURATION={
    namespace=namespace_str or DEFAULT_NAMESPACE,
    dimensions=parsed_dimensions or DEFAULT_DIMENSIONS,
    properties=parsed_properties or DEFAULT_PROPERTIES,
    metrics=parsed_metrics or DEFAULT_METRICS
  }

  -- Verify dimensions format
  if not verify_configuration("environment", CONFIGURATION) then
    print("[AWS_FLB_MONITORING]: validation failed for '" .. json.encode(CONFIGURATION) ..
          "'. Falling back to default configuration.")
    CONFIGURATION={
      namespace=namespace_str,
      dimensions=DEFAULT_DIMENSIONS,
      properties=DEFAULT_PROPERTIES,
      metrics=DEFAULT_METRICS
    }
    print(json.encode(CONFIGURATION))
  else
    print("[AWS_FLB_MONITORING]: configuration validated")
  end

  -- Modify configuration to make processing metrics efficient
  update_dimensionsets(CONFIGURATION["dimensions"], DEFAULT_ADDED_DIMENSIONS)
  update_metrics(CONFIGURATION)
end

-------------------------------------------------------------------------------
-- Metric Window Rate Calculator
-------------------------------------------------------------------------------

-- Queue mechanics
local List = {}
function List.new ()
  return {first = 0, last = -1}
end

function List.pushleft (list, value)
  local first = list.first - 1
  list.first = first
  list[first] = value
end

function List.pushright (list, value)
  local last = list.last + 1
  list.last = last
  list[last] = value
end

function List.popleft (list)
  local first = list.first
  if first > list.last then return nil end
  local value = list[first]
  list[first] = nil        -- to allow garbage collection
  list.first = first + 1
  return value
end

function List.popright (list)
  local last = list.last
  if list.first > last then return nil end
  local value = list[last]
  list[last] = nil         -- to allow garbage collection
  list.last = last - 1
  return value
end

--[[
Example metric_store variable populated with a single data point
metric_store: {
  "myMetricName": {
    "data": [
      {
        "value",
        "timestamp"
      }
    ]
  }
}
--]]
-- Add a metric point to a record containing recent data within window seconds of time
local metric_store = {}
local function add_metric_to_store(metric_name, value, timestamp_ms)
  metric_store[metric_name] = metric_store[metric_name] or {data=List.new()}
  List.pushright(metric_store[metric_name]["data"], {
    value=value,
    timestamp=timestamp_ms
  })
end

-- Get the metric window diff based on metric_name. Returns value_diff and timestamp_diff
local function get_metric_diff(metric_name, window_ms)
  data = metric_store[metric_name]["data"]

  -- pop newest
  newest_point = List.popright(data)
  if newest_point == nil then
    return {
      value_diff=0,
      timestamp_diff=0
    }
  end

  -- pop oldest until empty or we get to a timestamp that is more than window from left
  local oldest_point = List.popleft(data)
  if oldest_point == nil then
    List.pushright(metric_store[metric_name]["data"], newest_point)
    return {
      value_diff=0,
      timestamp_diff=0
    }
  end
  while oldest_point["timestamp"] < newest_point["timestamp"] - window_ms do
    local oldest_point_candidate = List.popleft(data)
    if oldest_point_candidate == nil then
      break
    end
    oldest_point = oldest_point_candidate
  end

  -- restore data
  List.pushleft(metric_store[metric_name]["data"], oldest_point)
  List.pushright(metric_store[metric_name]["data"], newest_point)

  return {
    value_diff=(newest_point["value"] - oldest_point["value"]),
    timestamp_diff=(newest_point["timestamp"] - oldest_point["timestamp"])
  }
end

-- Convert from human readable to machine readable byte values
function convert_size_to_bytes(size)
  -- for example "20b" or "5G"
  u = 1
  for i, unit in ipairs(SIZE_TO_BYTES_TABLE) do
    if string.sub(size, -1) == unit then
      break
    end
    u = u * 1024
  end

  return tonumber(string.sub(size, 1, -2)) * u
end

-------------------------------------------------------------------------------
-- EMF Record Modifiers
-------------------------------------------------------------------------------

-- Add metric to EMF payload
local function add_metrics(timestamp, alias, emf_record, metric_prefix, metrics,
                           metrics_manifest)
  for k, v in pairs(metrics) do
    -- Get metric name
    local metric_name = metric_prefix .. k
    local metric_name_suffix_default = (DEFAULT_WINDOW_OVERRIDES[metric_name] ==
                                        DEFAULT_RATE_WINDOW_SIZE) and RATE_SUFFIX or ""
    local metric_name_suffix = (CONFIGURATION["metrics"][metric_name] or {})["suffix"] or
                                metric_name_suffix_default
    local metric_name_frontend = metric_name .. metric_name_suffix
    local metric_store_name = alias .. "__" .. metric_name

    -- Add metrics if not explicitly removed in configuration
    if (CONFIGURATION["metrics"][metric_name] or {})["remove"] ~= true then
      -- Value modifiers
      local value = v
      local window = math.floor(((CONFIGURATION["metrics"][metric_name] or
                                  {})["rateWindow"] or
                                 DEFAULT_WINDOW_OVERRIDES[metric_name] or
                                 DEFAULT_WINDOW) + 0.5)
      local unit_mode = "cumulative"
      if window ~= -1 then
        add_metric_to_store(metric_store_name, v, timestamp)
        local diff = get_metric_diff(metric_store_name, window * 1000)
        value = diff["value_diff"] / (diff["timestamp_diff"]/1000) + 0.5
        unit_mode = "rate"
      end

      -- Add metric
      table.insert(emf_record["_aws"]["CloudWatchMetrics"][1]["Metrics"], {
        Name=metric_name_frontend,
        Unit=(CONFIGURATION["metrics"][metric_name] or {})["unit"] or
             (UNIT_OVERRIDES[metric_name] or DEFAULT_UNIT)[unit_mode],
        StorageResolution=math.floor(((CONFIGURATION["metrics"][metric_name] or
                                       {})["storageResolution"] or
                                     DEFAULT_STORAGE_RESOLUTION) + 0.5)
      })
      metrics_manifest[metric_name] = true

      -- Append targets
      emf_record[metric_name_frontend] = value
    end
  end
end

-- Add properties to emf record
local function add_properties(emf_record, properties)
  for k,v in pairs(properties) do
    emf_record[k] = v
  end
end

-- add dimensionsets to emf record
local function add_dimensionsets(emf_record, updated_dimensionsets)
  emf_record["_aws"]["CloudWatchMetrics"][1]["Dimensions"] = updated_dimensionsets
end

-------------------------------------------------------------------------------
-- AWS Monitoring JSON to EMF Metric Parser
-------------------------------------------------------------------------------

--[[
  Example Metrics
    [{
      Name ="FluentBitOutputErrors",
      Unit = "Count",
      StorageResolution = 1
    }]

  Example Dimension
    [
      "ClusterName",
      "TaskDefinitionFamily"
    ]

  Example Namespace
    "myNamespace!"

  Example Timestamp
    1701909831.175031900 <- From tag
--]]
function to_emf(tag, timestamp, record)

  local new_record = record

  -- Load environment variables
  load_environment_configuration()

  -- Truncate timestamp
  local parsed_timestamp = math.floor(timestamp * 1000)
  local ret, parsed_record=pcall(function() return json.decode(record["exec"]) end)
  if not ret then
    return -1, nil, nil
  end

  local emf_records = {}

  -- Add properties
  local emf_data_properties = record
  emf_data_properties["exec"] = nil

  -- Enumerate plugins
  for plugin_type, plugins in pairs(parsed_record["flb_metrics"]) do
    for alias, metrics in pairs(plugins) do

      -- Create emf starter payload
      local metrics_manifest = {}
      emf = {
        _aws = {
          Timestamp = parsed_timestamp,
          CloudWatchMetrics = {{
            Namespace = CONFIGURATION["namespace"],
            Dimensions = {},
            Metrics = {}
          }}
        }
      }

      -- Add properties to emf payload
      add_properties(emf, emf_data_properties)
      add_properties(emf, (CONFIGURATION["properties"] or {}))

      -- Add dimensions
      add_dimensionsets(emf, CONFIGURATION["dimensions"])
      add_properties(emf, {
        Alias = alias,
        PluginType = plugin_type
      })

      -- Add the plugin metrics
      add_metrics(parsed_timestamp, alias, emf, "", metrics, metrics_manifest)

      -- Add the disk metrics
      if plugin_type == "input" then
        storage_chunks = parsed_record["storage"]["input_chunks"][alias]["chunks"]
        storage_chunks["busy_size"] = convert_size_to_bytes(storage_chunks["busy_size"])
        add_metrics(parsed_timestamp, alias, emf, "disk_chunks_", storage_chunks,
                    metrics_manifest)
        
        -- Add the memory settings for inputs
        local memory_metrics = parsed_record["storage"]["input_chunks"][alias]["status"]
        memory_metrics["memory_overlimit"] = memory_metrics["overlimit"] and 1 or 0
        memory_metrics["memory_size"] = convert_size_to_bytes(memory_metrics["mem_size"])
        memory_metrics["memory_limit"] = convert_size_to_bytes(
                                                             memory_metrics["mem_limit"])
        memory_metrics["overlimit"] = nil
        memory_metrics["mem_size"] = nil
        memory_metrics["mem_limit"] = nil
        add_metrics(parsed_timestamp, alias, emf, "", memory_metrics, metrics_manifest)
      end

      -- Add additional metrics
      for metric_property, metric_configuration in pairs(CONFIGURATION["metrics"]) do
        if (metrics_manifest[metric_property] == nil and
            metric_configuration["remove"] ~= true) then
          -- Check if the field is present
          if emf[metric_property] ~= nil then
            -- Add metric
            add_metrics(parsed_timestamp, alias, emf, "", {
                [metric_property]=emf[metric_property]
              }, metrics_manifest)
          end
        end
      end

      -- Append emf record to log
      table.insert(emf_records, emf)
    end
  end

  return 1, timestamp, emf_records
end

-------------------------------------------------------------------------------
-- The following JSON converter has been sourced from an MIT licenced third
-- party library.
--
-- Other JSON string to table implementation may be used in its place.
--
-- Beginning of json.lua software...
-------------------------------------------------------------------------------

-- JSON Lua converter from https://gist.github.com/tylerneylon/59f4bcf316be525b30ab
--
-- json.lua
--
-- Copyright (c) 2020 rxi
--
-- Permission is hereby granted, free of charge, to any person obtaining a copy of
-- this software and associated documentation files (the "Software"), to deal in
-- the Software without restriction, including without limitation the rights to
-- use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
-- of the Software, and to permit persons to whom the Software is furnished to do
-- so, subject to the following conditions:
--
-- The above copyright notice and this permission notice shall be included in all
-- copies or substantial portions of the Software.
--
-- THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
-- IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
-- FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
-- AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
-- LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
-- OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
-- SOFTWARE.
--

-- The following line is commented out of the original library and moved to 
-- the top of this lua file for the purpose of hoisting json functionality
-- local json = { _version = "0.1.2" }

-------------------------------------------------------------------------------
-- Encode
-------------------------------------------------------------------------------

local encode

local escape_char_map = {
  [ "\\" ] = "\\",
  [ "\"" ] = "\"",
  [ "\b" ] = "b",
  [ "\f" ] = "f",
  [ "\n" ] = "n",
  [ "\r" ] = "r",
  [ "\t" ] = "t",
}

local escape_char_map_inv = { [ "/" ] = "/" }
for k, v in pairs(escape_char_map) do
  escape_char_map_inv[v] = k
end


local function escape_char(c)
  return "\\" .. (escape_char_map[c] or string.format("u%04x", c:byte()))
end


local function encode_nil(val)
  return "null"
end


local function encode_table(val, stack)
  local res = {}
  stack = stack or {}

  -- Circular reference?
  if stack[val] then error("circular reference") end

  stack[val] = true

  if rawget(val, 1) ~= nil or next(val) == nil then
    -- Treat as array -- check keys are valid and it is not sparse
    local n = 0
    for k in pairs(val) do
      if type(k) ~= "number" then
        error("invalid table: mixed or invalid key types")
      end
      n = n + 1
    end
    if n ~= #val then
      error("invalid table: sparse array")
    end
    -- Encode
    for i, v in ipairs(val) do
      table.insert(res, encode(v, stack))
    end
    stack[val] = nil
    return "[" .. table.concat(res, ",") .. "]"

  else
    -- Treat as an object
    for k, v in pairs(val) do
      if type(k) ~= "string" then
        error("invalid table: mixed or invalid key types")
      end
      table.insert(res, encode(k, stack) .. ":" .. encode(v, stack))
    end
    stack[val] = nil
    return "{" .. table.concat(res, ",") .. "}"
  end
end


local function encode_string(val)
  return '"' .. val:gsub('[%z\1-\31\\"]', escape_char) .. '"'
end


local function encode_number(val)
  -- Check for NaN, -inf and inf
  if val ~= val or val <= -math.huge or val >= math.huge then
    error("unexpected number value '" .. tostring(val) .. "'")
  end
  return string.format("%.14g", val)
end


local type_func_map = {
  [ "nil"     ] = encode_nil,
  [ "table"   ] = encode_table,
  [ "string"  ] = encode_string,
  [ "number"  ] = encode_number,
  [ "boolean" ] = tostring,
}


encode = function(val, stack)
  local t = type(val)
  local f = type_func_map[t]
  if f then
    return f(val, stack)
  end
  error("unexpected type '" .. t .. "'")
end


function json.encode(val)
  return ( encode(val) )
end


-------------------------------------------------------------------------------
-- Decode
-------------------------------------------------------------------------------

local parse

local function create_set(...)
  local res = {}
  for i = 1, select("#", ...) do
    res[ select(i, ...) ] = true
  end
  return res
end

local space_chars   = create_set(" ", "\t", "\r", "\n")
local delim_chars   = create_set(" ", "\t", "\r", "\n", "]", "}", ",")
local escape_chars  = create_set("\\", "/", '"', "b", "f", "n", "r", "t", "u")
local literals      = create_set("true", "false", "null")

local literal_map = {
  [ "true"  ] = true,
  [ "false" ] = false,
  [ "null"  ] = nil,
}


local function next_char(str, idx, set, negate)
  for i = idx, #str do
    if set[str:sub(i, i)] ~= negate then
      return i
    end
  end
  return #str + 1
end


local function decode_error(str, idx, msg)
  local line_count = 1
  local col_count = 1
  for i = 1, idx - 1 do
    col_count = col_count + 1
    if str:sub(i, i) == "\n" then
      line_count = line_count + 1
      col_count = 1
    end
  end
  error( string.format("%s at line %d col %d", msg, line_count, col_count) )
end


local function codepoint_to_utf8(n)
  -- http://scripts.sil.org/cms/scripts/page.php?site_id=nrsi&id=iws-appendixa
  local f = math.floor
  if n <= 0x7f then
    return string.char(n)
  elseif n <= 0x7ff then
    return string.char(f(n / 64) + 192, n % 64 + 128)
  elseif n <= 0xffff then
    return string.char(f(n / 4096) + 224, f(n % 4096 / 64) + 128, n % 64 + 128)
  elseif n <= 0x10ffff then
    return string.char(f(n / 262144) + 240, f(n % 262144 / 4096) + 128,
                       f(n % 4096 / 64) + 128, n % 64 + 128)
  end
  error( string.format("invalid unicode codepoint '%x'", n) )
end


local function parse_unicode_escape(s)
  local n1 = tonumber( s:sub(1, 4),  16 )
  local n2 = tonumber( s:sub(7, 10), 16 )
   -- Surrogate pair?
  if n2 then
    return codepoint_to_utf8((n1 - 0xd800) * 0x400 + (n2 - 0xdc00) + 0x10000)
  else
    return codepoint_to_utf8(n1)
  end
end


local function parse_string(str, i)
  local res = ""
  local j = i + 1
  local k = j

  while j <= #str do
    local x = str:byte(j)

    if x < 32 then
      decode_error(str, j, "control character in string")

    elseif x == 92 then -- `\`: Escape
      res = res .. str:sub(k, j - 1)
      j = j + 1
      local c = str:sub(j, j)
      if c == "u" then
        local hex = str:match("^[dD][89aAbB]%x%x\\u%x%x%x%x", j + 1)
                 or str:match("^%x%x%x%x", j + 1)
                 or decode_error(str, j - 1, "invalid unicode escape in string")
        res = res .. parse_unicode_escape(hex)
        j = j + #hex
      else
        if not escape_chars[c] then
          decode_error(str, j - 1, "invalid escape char '" .. c .. "' in string")
        end
        res = res .. escape_char_map_inv[c]
      end
      k = j + 1

    elseif x == 34 then -- `"`: End of string
      res = res .. str:sub(k, j - 1)
      return res, j + 1
    end

    j = j + 1
  end

  decode_error(str, i, "expected closing quote for string")
end


local function parse_number(str, i)
  local x = next_char(str, i, delim_chars)
  local s = str:sub(i, x - 1)
  local n = tonumber(s)
  if not n then
    decode_error(str, i, "invalid number '" .. s .. "'")
  end
  return n, x
end


local function parse_literal(str, i)
  local x = next_char(str, i, delim_chars)
  local word = str:sub(i, x - 1)
  if not literals[word] then
    decode_error(str, i, "invalid literal '" .. word .. "'")
  end
  return literal_map[word], x
end


local function parse_array(str, i)
  local res = {}
  local n = 1
  i = i + 1
  while 1 do
    local x
    i = next_char(str, i, space_chars, true)
    -- Empty / end of array?
    if str:sub(i, i) == "]" then
      i = i + 1
      break
    end
    -- Read token
    x, i = parse(str, i)
    res[n] = x
    n = n + 1
    -- Next token
    i = next_char(str, i, space_chars, true)
    local chr = str:sub(i, i)
    i = i + 1
    if chr == "]" then break end
    if chr ~= "," then decode_error(str, i, "expected ']' or ','") end
  end
  return res, i
end


local function parse_object(str, i)
  local res = {}
  i = i + 1
  while 1 do
    local key, val
    i = next_char(str, i, space_chars, true)
    -- Empty / end of object?
    if str:sub(i, i) == "}" then
      i = i + 1
      break
    end
    -- Read key
    if str:sub(i, i) ~= '"' then
      decode_error(str, i, "expected string for key")
    end
    key, i = parse(str, i)
    -- Read ':' delimiter
    i = next_char(str, i, space_chars, true)
    if str:sub(i, i) ~= ":" then
      decode_error(str, i, "expected ':' after key")
    end
    i = next_char(str, i + 1, space_chars, true)
    -- Read value
    val, i = parse(str, i)
    -- Set
    res[key] = val
    -- Next token
    i = next_char(str, i, space_chars, true)
    local chr = str:sub(i, i)
    i = i + 1
    if chr == "}" then break end
    if chr ~= "," then decode_error(str, i, "expected '}' or ','") end
  end
  return res, i
end


local char_func_map = {
  [ '"' ] = parse_string,
  [ "0" ] = parse_number,
  [ "1" ] = parse_number,
  [ "2" ] = parse_number,
  [ "3" ] = parse_number,
  [ "4" ] = parse_number,
  [ "5" ] = parse_number,
  [ "6" ] = parse_number,
  [ "7" ] = parse_number,
  [ "8" ] = parse_number,
  [ "9" ] = parse_number,
  [ "-" ] = parse_number,
  [ "t" ] = parse_literal,
  [ "f" ] = parse_literal,
  [ "n" ] = parse_literal,
  [ "[" ] = parse_array,
  [ "{" ] = parse_object,
}


parse = function(str, idx)
  local chr = str:sub(idx, idx)
  local f = char_func_map[chr]
  if f then
    return f(str, idx)
  end
  decode_error(str, idx, "unexpected character '" .. chr .. "'")
end


function json.decode(str)
  if type(str) ~= "string" then
    error("expected argument of type string, got " .. type(str))
  end
  local res, idx = parse(str, next_char(str, 1, space_chars, true))
  idx = next_char(str, idx, space_chars, true)
  if idx <= #str then
    decode_error(str, idx, "trailing garbage")
  end
  return res
end


-------------------------------------------------------------------------------
-- End of json.lua software
--
-- The above JSON converter has been sourced from an MIT licenced thirds party
-- library.
--
-- See copyright in section above.
-------------------------------------------------------------------------------
