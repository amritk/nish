import glob,os,re
R='/tmp/claude-0/-home-user/495d7503-79d7-5bad-b184-656df3811dd4/scratchpad/r609'
def verdict(line):
    parts=[p.strip() for p in line.split(' | ')]
    if len(parts)<2: return '?'
    if parts[1].startswith('REFUSED'):
        codes=re.findall(r'NL\d{4}',line)
        return 'REFUSED '+','.join(sorted(set(codes))) if codes else 'REFUSED(other)'
    return 'ACCEPTED '+parts[-1]
def rd(p): return open(p).read().strip() if os.path.exists(p) else ''
names=sorted(set(os.path.basename(f).split('.')[0] for f in glob.glob(R+'/r3/out/*.head.rr')))
for n in names:
    h=rd(R+'/r3/out/%s.head.rr'%n); m=rd(R+'/r3/out/%s.main.rr'%n)
    prev=rd(R+'/r2/out/%s.head.r1'%n) or rd(R+'/r2/out/%s.head.r2'%n)
    vh=verdict(h); vm=verdict(m) if m else '-'; vp=verdict(prev) if prev else '-'
    flag=[]
    if vp!=vh: flag.append('CHANGED-since-r2')
    if 'DIFFER' in vh: flag.append('MISMATCH-head')
    print('%-45s r2head=%-26s head=%-26s main=%-26s %s'%(n,vp,vh,vm,' '.join(flag)))
