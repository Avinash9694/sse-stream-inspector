/**
 * Reproduces a real gateway bug: the "thinking state" frame arrives under two
 * spellings within one turn, and the payload shape follows the spelling —
 * `thinking_state` is component-shaped, `thinking-state` is flat. A client
 * switching on the literal `thinking_state` renders one line in five.
 */
export const DUAL_SPELLING_STREAM = `: t=0
event: turn_start
data: {"request_id":"req_7f3a","conversation_id":"conv_118","model":"gateway-v3"}

: t=120
event: thinking_state
data: {"component":{"type":"thinking","props":{"children":"Reading the conversation context"}},"state":"active"}

: t=640
event: thinking-state
data: {"message":"Checking which AWS accounts are in scope","content":"3 profiles selected","state":"active"}

: t=1210
event: thinking_state
data: {"component":{"type":"thinking","props":{"children":"Querying estate for public S3 buckets"}},"state":"active"}

: t=1890
event: thinking-state
data: {"message":"Found 2 buckets with public ACLs","content":"logs-prod-eu, assets-cdn","state":"active"}

: t=2400
event: thinking-state
data: {"message":"Drafting the answer","state":"done"}

: t=2650
event: component_start
data: {"component_id":"c1","type":"markdown"}

: t=2700
event: component_delta
data: {"component_id":"c1","delta":"Two buckets in "}

: t=2760
event: component_delta
data: {"component_id":"c1","delta":"**prod-eu** allow "}

: t=2810
event: component_delta
data: {"component_id":"c1","delta":"public reads: "}

: t=2870
event: component_delta
data: {"component_id":"c1","delta":"\`logs-prod-eu\` and "}

: t=2920
event: component_delta
data: {"component_id":"c1","delta":"\`assets-cdn\`. "}

: t=2990
event: component_delta
data: {"component_id":"c1","delta":"The first is almost certainly unintended."}

: t=3050
event: component_end
data: {"component_id":"c1"}

: t=3100
event: sources
data: {"evidences":[{"source":"From Cloud Estate","step_type":"estate","time_when_run":"2026-10-24T09:12:00Z"},{"source":"Live S3 ACL check","step_type":"live","metadata":{"region":"eu-west-1"}}]}

: t=3180
event: done
data: {"request_id":"req_7f3a","usage":{"input_tokens":1840,"output_tokens":62},"chat_title":"Public S3 buckets in prod-eu"}

`;
