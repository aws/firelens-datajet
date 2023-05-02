SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

_term() { 
  echo "Caught SIGTERM signal!" 
  kill -TERM "$child" 2>/dev/null
}

trap _term SIGTERM

# Start the mock API
docker pull bbyars/mountebank:2.8.2
docker run --rm --privileged -p 4430:4430 -p 2525:2525 -p 4545:4545 -p 5555:5555 bbyars/mountebank:2.8.2 start &

# docker run --privileged --network host --rm -p 2525:2525 -p 4545:4545 -p 5555:5555 bbyars/mountebank:2.8.2 start &
child=$!

sleep 1

config=`cat $SCRIPT_DIR/mountebank.json`
echo $config
curl -i -X POST -H 'Content-Type: application/json' http://localhost:2525/imposters --data "$config"

wait "$child"
