couchbase-view-manager
======================

A View Manager for CouchBase written in Node.JS

# Usage

```shell
Usage: node ./view_manager.js -u [str] -p [str] -D [dir] [opts] --force --update

Options:
  -p, --bucket-password  [default: ""]
  -H, --host             [default: "127.0.0.1:8091"]
  -D, --directory        [default: "views"]
  --dev                  [default: false]
  -l, --list             [default: null]
  -e, --no-eval          [default: false]
  -b, --bucket           [default: null]
  -d, --design           [default: null]
  -v, --view             [default: false]
  -f, --force            [default: false]
  -u, --update           [default: false]
  -h, --help             [default: false]
  -V, --version          [default: false]
```

## View Directory

Example with 2 buckets (*user* and *images*), and 2 designs for *user* (*info*, *stats*).


```shell
$ ls -lR
-rw-r--r-- 1 nico nico 7,0K mai   28 16:45 view_manager.js

./views:
total 8,0K
drwxr-xr-x 2 nico nico 4,0K mai   28 16:54 images
drwxr-xr-x 4 nico nico 4,0K mai   28 17:03 user

./views/images:
total 0

./views/user:
total 8,0K
drwxr-xr-x 2 nico nico 4,0K mai   28 17:03 info
drwxr-xr-x 2 nico nico 4,0K mai   28 17:00 stats

./views/user/info:
total 0

./views/user/stats:
total 0
-rw-r--r-- 1 nico nico 0 mai   28 17:00 aggreg.map.js
-rw-r--r-- 1 nico nico 0 mai   28 17:00 aggreg.reduce.js
```

# To push the view *aggreg*

## Syntax

You have to follow some rules:

| | map function | reduce function |
|-----------|------------|----------|
| naming | aggreg*.map.js* | aggreg*.reduce.js* |
| required | yes | no |
| syntax |  ```javascript function(doc, meta) {/*...*/}``` | ``` _count ``` *or* ```javascript function(key, values, rereduce) {/*...*/} ```

## Command line

### first push

```
$ node ./view_manager.js -b user -d stats -v aggreg
users/stats/aggreg                                  created
```

### view already exists

```
$ node ./view_manager.js -b user -d stats -v aggreg
users/stats/aggreg                                  not changed
```

### view already exists, and your local version has changed

```
$ node ./view_manager.js -b user -d stats -v aggreg
users/stats/aggreg                                  changed but not updated
```

You have to precise the `--update` option.

```
$ node ./view_manager.js -b user -d stats -v aggreg --update
users/stats/aggreg                                  updated
```

with `--force`, all views are pushed without verification.


## Evaluation

The `-e` option (default to true) and stops sending if your view is not a valid JS.

## Dev

The dev option (default to false) push views on the dev design. Else on the prod  one.
