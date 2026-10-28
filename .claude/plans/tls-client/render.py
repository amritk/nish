import yaml, re, sys
plan = open('.claude/plans/tls-client.plan.md').read()
fm = yaml.safe_load(plan.split('---')[1])
stages = {s['id']: s for s in fm['stages']}
filters = {'pubkey-verify':'crypto_rsa, crypto_p384', 'x509-path':'x509', 'tls-client-core':'net_tls', 'tls-client-tcp':'net_tls_client, net_tls_tcp'}
def owns(sid):
    m = re.search(r'## Stage '+re.escape(sid)+r'\n\n\*\*Owns:\*\*(.*?)\n', plan)
    return m.group(1).strip()
extra = {
 'x509-path': "\nMERGE-ORDER NOTE: pubkey-verify (RSA + P-384 verifiers, std/crypto/rsa.ts and p384.ts) is being built in parallel by another session. Do every todo except x509-wire-verifiers now, against main, with RSA/P-384 hops returning X509_PATH_UNSUPPORTED_ALGORITHM. When the lead messages you that pubkey-verify has merged, merge main, do x509-wire-verifiers against the interfaces fixed in the plan's Approach section, add the RSA/P-384 vectors, and push. You may open the PR before that, as a draft titled as below, and mark it ready once the wiring is in.\n",
 'tls-client-core': "\nINDEPENDENCE NOTE: this stage authenticates nothing itself. Authentication is injected through WAIT_AUTH / authenticate(ok), as the plan's Approach says. Tests that need a 'verified' server pass authenticate(true) after checking the CertificateVerify with p256Verify (the in-repo TlsServer signs with P-256). The real validator lands in a later stage. Do not import std/crypto/rsa.ts or x509-path.ts; they do not exist on main yet.\n",
 'tls-client-tcp': "\nDEPENDENCY NOTE: pubkey-verify, x509-path and tls-client-core are merged on main; build on their real interfaces. This is the last stage: put `Fixes #480` in the PR body.\n",
}
tmpl = open(sys.argv[1]).read()
sid = sys.argv[2]; s = stages[sid]
todos = '\n'.join(f"- [{t['id']}] {t['content']}" for t in s['todos'])
out = tmpl.format(stage_id=sid, title=s['title'], goal=s['goal'], owns=owns(sid), verification=s['verification'], filters=filters[sid], todos=todos, extra=extra.get(sid,''), fixes='Fixes #480' if sid=='tls-client-tcp' else 'Refs #480')
open(f"{sys.argv[3]}/prompt-{sid}.txt",'w').write(out); print(sid, len(out))
