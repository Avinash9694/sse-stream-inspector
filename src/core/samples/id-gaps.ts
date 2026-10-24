/** Ticker with ids: one duplicate (`104`), one regression (`103` after `106`), a 7 s silence. */
export const ID_GAPS_STREAM = `: t=0
retry: 3000
id: 101
event: price
data: {"symbol":"ESCH","price":42.10,"ts":1761296400000}

: t=500
id: 102
event: price
data: {"symbol":"ESCH","price":42.14,"ts":1761296400500}

: t=1000
id: 103
event: price
data: {"symbol":"ESCH","price":42.09,"ts":1761296401000}

: t=1500
id: 104
event: price
data: {"symbol":"ESCH","price":42.22,"ts":1761296401500}

: t=1520
id: 104
event: price
data: {"symbol":"ESCH","price":42.22,"ts":1761296401500}

: t=2000
id: 105
event: price
data: {"symbol":"ESCH","price":42.31,"ts":1761296402000}

: t=2500
id: 106
event: price
data: {"symbol":"ESCH","price":42.27,"ts":1761296402500}

: t=2900
id: 103
event: price
data: {"symbol":"ESCH","price":42.09,"ts":1761296401000}

: t=3000
: keep-alive

: t=10000
id: 107
event: price
data: {"symbol":"ESCH","price":42.40,"ts":1761296410000}

: t=10500
id: 108
event: price
data: {"symbol":"ESCH","price":42.44,"ts":1761296410500}

: t=11000
id: 109
event: complete
data: {"reason":"market_close"}

`;
