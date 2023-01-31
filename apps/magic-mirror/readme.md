# Magic Mirror
## Build and run commands
```
docker build . -t=magicmirror
sudo docker run -it magicmirror:latest
```

## Commands do not work cross volume
```
sudo docker run -it -v `pwd`/log-source:/source -v `pwd`/log-destination:/destination --env SOURCE=/source --env DESTINATION=/destination --env DELAY=5 magicmirror:latest
```

ln: failed to create hard link '/destination/hello' => '/source/hello': Invalid cross-device link

## Working docker command
```
mkdir ./lib
mkdir ./lib/source
sudo docker run -it -v `pwd`/lib:/lib --env SOURCE=/lib/source --env DESTINATION=/lib/destination --env DELAY=5 magicmirror:latest
```