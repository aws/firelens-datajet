#!/bin/bash

bucket=$1
watchlist=$2

IFS=',' read -ra dirs <<< "$watchlist"

for i in "${!dirs[@]}"; do
  dirs[i]=$(echo "${dirs[i]}" | sed 's|^/||')
done

while true; do
  for dir in "${dirs[@]}"; do
    aws s3 sync "$dir" "s3://$bucket/$dir"
  done

  sleep 60
done
