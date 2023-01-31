#!/bin/bash

source=$1
destination=$2
delay=$3

mkdir -p $destination

echo "o----------------------o"
echo "|                      |"
echo "|                      |"
echo "|                      |"
echo "|                      |"
echo "|   ~ Magic Mirror ~   |"
echo "|                      |"
echo "|         v1.0         |"
echo "|                      |"
echo "|                      |"
echo "|                      |"
echo "|                      |"
echo "o----------------------o"



# Wipe all files and directories from destination (Reconsider)
# rm -r "$destination"/*

# Copy all files from source to destination
cp -alr "$source"/* "$destination"/

# Keep track of the last MOVED_FROM event
old_file=""

inotifywait -m -r --format %e\;%w%f $source -e CREATE -e DELETE  -e MOVED_FROM -e MOVED_TO | while read -r line; do
  # Split events into an array
  IFS=';' read -r -a event_array <<< "$line"

  echo "EVENT: $line"

  # Check if create event
  if [[ "${event_array[0]}" =~ CREATE.* ]]; then
    file="${event_array[1]}"
    if [ -d "$file" ]; then
      # If directory, create it in destination
      mkdir -p "$destination/${file#$source/}"
    else
      # If file, create hard link in destination
      ln "$file" "$destination/${file#$source/}"
    fi
  fi

  # Check if delete event
  if [[ "${event_array[0]}" =~ DELETE.* ]]; then
    file="${destination}/${event_array[1]#$source/}"
    if [ -d "$file" ]; then
      # If directory, wait $delay seconds before deleting it in destination
      (sleep $delay && rm -rf "$file") &
    else
      # If file, wait $delay seconds before deleting it in destination
      (sleep $delay && rm -f "$file") &
    fi
  fi

  # Check if move event (MOVED_FROM)
  if [[ "${event_array[0]}" =~ MOVED_FROM.* ]]; then
    old_file="${destination}/${event_array[1]#$source/}"
  fi

  # Check if move event (MOVED_TO)
  if [[ "${event_array[0]}" =~ MOVED_TO.* ]]; then
    file="${destination}/${event_array[1]#$source/}"
    new_file="$old_file"
    old_file=""
    mv "$new_file" "$file"
  fi
done
