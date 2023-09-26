#  Usage: Check results of firelens release stability tests
#
#  $1 = region
#  $2 = cluster name
#  $3 = Execution ID
# 
# output order is the same as in our result table template
# output is number of running tasks first, then number of cores


familys_golden="
ecs-firelens-stability-tests-golden-path-no-onepod-low-throughput
ecs-firelens-stability-tests-golden-path-onepod-low-throughput
ecs-firelens-stability-tests-golden-path-onepod-low-throughput-real
ecs-firelens-stability-tests-golden-path-no-onepod-high-throughput
ecs-firelens-stability-tests-golden-path-onepod-high-throughput
"

familys_s3_stability="
ecs-firelens-stability-tests-s3-stability-s3-throughput-1mbps
ecs-firelens-stability-tests-s3-stability-s3-throughput-30mbps
"

familys_s3_sensitivity="
ecs-firelens-stability-tests-s3-sensitivity-s3-control
ecs-firelens-stability-tests-s3-sensitivity-s3-outputPluginCount-10
ecs-firelens-stability-tests-s3-sensitivity-s3-s3_compression-gzip
ecs-firelens-stability-tests-s3-sensitivity-s3-s3_key_format-advanced
ecs-firelens-stability-tests-s3-sensitivity-s3-throughput-10mbps
ecs-firelens-stability-tests-s3-sensitivity-s3-total_file_size-1M
ecs-firelens-stability-tests-s3-sensitivity-s3-upload_timeout-1m
ecs-firelens-stability-tests-s3-sensitivity-s3-use_put_object-on
"

if [ -z "${1}" ]
then
    echo "Usage: check_results.sh {region} {cluster} {execution ID}"
    exit 1
fi
if [ -z "${2}" ]
then
    echo "Usage: check_results.sh {region} {cluster} {execution ID}"
    exit 1
fi
if [ -z "${3}" ]
then
    echo "Usage: check_results.sh {region} {cluster} {execution ID}"
    exit 1
fi

echo "Cluster: ${2} ${1}"
echo "Execution: ${3}"
echo "____Task Counts____"
echo ""

echo "____GOLDEN PATH Task Counts____" 
for task_def in $familys_golden; do
    running_count=$(aws ecs list-tasks --cluster $2 --region $1  --family $task_def --output json | jq '.taskArns | length')
    echo "${task_def}: ${running_count}"
done


echo "____S3 stability Task Counts____"
for task_def in $familys_s3_stability; do
    running_count=$(aws ecs list-tasks --cluster $2 --region $1  --family $task_def --output json | jq '.taskArns | length')
    echo "${task_def}: ${running_count}"
done


echo "____S3 sensitivity Task Counts____"
for task_def in $familys_s3_sensitivity; do
    running_count=$(aws ecs list-tasks --cluster $2 --region $1  --family $task_def --output json | jq '.taskArns | length')
    echo "${task_def}: ${running_count}"
done


echo "____Core Counts____"
total_cores=$(aws s3 ls s3://stability-output/${3} --recursive --output json | grep "stacktrace" | wc -l)
echo "Total Cores: ${3}: ${total_cores}"
echo ""

echo "____GOLDEN PATH Core Counts____" 
for task_def in $familys_golden; do
    cores=$(aws s3 ls s3://stability-output/${3}/${task_def} --recursive --output json | grep "stacktrace" | wc -l)
    echo "${task_def}: ${cores}"
done


echo "____S3 stability Core Counts____"
for task_def in $familys_s3_stability; do
    cores=$(aws s3 ls s3://stability-output/${3}/${task_def} --recursive --output json | grep "stacktrace" | wc -l)
    echo "${task_def}: ${cores}"
done


echo "____S3 sensitivity Core Counts____"
for task_def in $familys_s3_sensitivity; do
    cores=$(aws s3 ls s3://stability-output/${3}/${task_def} --recursive --output json | grep "stacktrace" | wc -l)
    echo "${task_def}: ${cores}"
done
