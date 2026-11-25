# Live AI evaluation

Three genuine Groq requests returned HTTP 200. Two earlier invocations were rejected locally before networking because the evaluation base URL repeated the API prefix already added by the SDK. The harness counters showed three blocked attempts each. The two successful live invocations used one and two requests respectively. The aggregate was three provider requests, or nine attempts even counting the six local rejections, within the 12-request budget. No provider HTTP errors or rate limits were observed.

The harness used a fictional fixed BIT Year 3 Semester 2 profile, a fresh chat session, SQLite in memory, local JSON vectors with forced lexical retrieval and temporary output. It clears inherited application settings, restricts outbound transport to Groq, disables redirects and SDK retries, and caps requests. A temporary audit wrapper loaded only the Groq key from the documented private local configuration, limited requests to POST /openai/v1/chat/completions, and recorded model, status, latency and token counts. No existing student records, application credentials or production conversations were included. The ordinary isolated preview retained its separate network block.

## Final six-prompt run

Latency is elapsed time measured within the evaluation process, not hosted browser latency. Source counts are returned answer sources.

| Question | Expected evidence | Observed response | Latency | Assessment |
|---|---|---|---:|---|
| What programmes can I study if I like history? | Verified programme catalogue and qualified interest fit | Politics and International Relations, Development Studies, and Public Administration. Asked which aspect of history interested the student. Three official programme sources. | 269 ms | Deterministic Advisor offered useful clarification and labelled inferred fit. |
| How much would accommodation cost me? | Retained accommodation pricing evidence with current applicability, or honest uncertainty | Reported unavailable information, suggested Registry or a separately confirmed support request. Zero answer sources. | 2,903 ms | Live planning and grounded generation ran. No verified current price was established, and the fallback avoided inventing one. |
| Where can I get help with my fees? | Finance support contact or explicit distinction between finding help and calculating fees | Asked for local/SADC versus international status and programme. Zero sources. | 14 ms | Deterministic clarification was relevant to a fee quotation but did not answer the request for a support destination. |
| What does the university hospital offer? | Retained hospital brochure, clearly qualified by date and verification | Listed emergency, outpatient, specialist, maternity and diagnostic services, with availability qualifications. One brochure source. | 32 ms | Deterministic evidence-backed response. Longer than necessary for a broad opening question. |
| What's my longest break on Monday? | Authorized fictional profile and retained recurring timetable | Four hours, 12:00–16:00. One timetable source. | 208 ms | Deterministic personalized calculation. |
| What about Friday? | Same profile and previous gap calculation intent | One hour, 14:00–15:00. One timetable source. | 135 ms | Deterministic session continuity. |

## Provider evidence

| Run | Capability | Model | HTTP | Time | Prompt / completion tokens |
|---|---|---|---:|---:|---:|
| Before routing repair | Ungrounded conversation generation | qwen/qwen3.8-27b | 200 | 754 ms | 220 / 63 |
| After routing repair | Semantic retrieval planning | openai/gpt-oss-20b | 200 | 1,287 ms | 648 / 322 |
| After routing repair | Grounded generation | qwen/qwen3.8-27b | 200 | 1,017 ms | 1,449 / 127 |

The first accommodation answer did not invent a price, but referred to a housing portal and office without evidence. The route treated the word accommodation as general conversation. Adding it to the existing institutional routing guard sent the same question through retrieval on the next run. Dense retrieval was intentionally disabled. The grounded generation received local evidence and declined to state a price, triggering the documented fallback. This demonstrates live planner/generator execution and safe uncertainty for one scenario. Broad generated-answer quality, grounding across other university procedures, and hosted semantic retrieval quality remain unverified. None of the structured answers were counted as live AI quality evidence.

The secure owner-run command remains available if a repeat evaluation is approved:

```powershell
$groqInput = Read-Host 'Groq API key' -AsSecureString
try {
    $env:GROQ_API_KEY = [System.Net.NetworkCredential]::new('', $groqInput).Password
    node scripts/evaluate-live-ai.cjs --approved-live-inference
} finally {
    Remove-Item Env:GROQ_API_KEY -ErrorAction SilentlyContinue
    $groqInput.Dispose()
}
```

## Regression verification

After the routing fix, the focused orchestration suite passed 31 of 31, the full backend suite passed 611 of 611, and the widget suite passed 187 of 187. The evaluation harness passed Node syntax checking. The accepted v5 ZIP predates these fixes.

The fee-help limitation above describes the earlier run. The later scoped fee-help repair routes informational fee enquiries to sourced Finance Office guidance. See FINAL_RELEASE_PLAN.md for the focused and full regression evidence. No additional Groq requests were made for this routing repair.
