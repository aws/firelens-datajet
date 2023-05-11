#  Usage: Check results of firelens release stability tests
#
#  $1 = region
#  $2 = cluster name
# 
# output order is the same as in our result table template


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

echo "Cluster: ${2} ${1}"

echo "____GOLDEN PATH____" 
for task_def in $familys_golden; do
    running_count=$(aws ecs list-tasks --cluster $2 --region $1  --family $task_def | jq '.taskArns | length')
    echo "${task_def}: ${running_count}"
done


echo "____S3 stability____"
for task_def in $familys_s3_stability; do
    running_count=$(aws ecs list-tasks --cluster $2 --region $1  --family $task_def | jq '.taskArns | length')
    echo "${task_def}: ${running_count}"
done


echo "____S3 sensitivity____"
for task_def in $familys_s3_sensitivity; do
    running_count=$(aws ecs list-tasks --cluster $2 --region $1  --family $task_def | jq '.taskArns | length')
    echo "${task_def}: ${running_count}"
done
