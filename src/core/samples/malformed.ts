/** Every malformed shape the diagnostics know about, in one stream. */
export const MALFORMED_STREAM = `: t=0
event: status
data: {"phase":"starting","percent":0}

: t=200
event: status
foo: this field is not in the spec
data: {"phase":"loading","percent":20}

: t=400
event: status
retry: soon
data: {"phase":"loading","percent":40}

: t=600
event: progress
id: p-1

: t=800
event: status
data: {"phase":"loading","percent":60,"detail":{"file":"estate.json"}}

: t=1000
event: status
data: {"phase":"loading","percent":

: t=1200
event: status
data: 80}

: t=1400
event: status
data: {"phase":"loading","percent":"100"}

: t=1600
event: result
data: {"ok":true,"items":[1,2,3]}

: t=1800
event: result
data: {"ok":true,"items":["a","b"]}

: t=2000
event: done
data: {"ok":true`;
