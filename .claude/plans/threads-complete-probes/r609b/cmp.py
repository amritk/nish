import sys,glob,os,re
R='/tmp/claude-0/-home-user/495d7503-79d7-5bad-b184-656df3811dd4/scratchpad/r609'
def verdict(line):
    parts=[p.strip() for p in line.split(' | ')]
    if len(parts)<2: return ('?',line)
    if parts[1].startswith('REFUSED'):
        codes=re.findall(r'NL\d{4}',line)
        return ('REFUSED '+','.join(sorted(set(codes))) if codes else 'REFUSED(other)', line)
    return ('ACCEPTED '+parts[-1], line)
r1={}
for l in open(R+'/results-r609.txt'):
    if l.startswith('#') or ' | ' not in l: continue
    n=l.split(' | ')[0].strip(); r1[n]=l.strip()
tag=sys.argv[1]
names=sorted(set(os.path.basename(f).split('.')[0] for f in glob.glob(R+'/r2/out/*.'+tag)))
for n in names:
    h=open(R+'/r2/out/%s.head.%s'%(n,tag)).read().strip() if os.path.exists(R+'/r2/out/%s.head.%s'%(n,tag)) else ''
    m=open(R+'/r2/out/%s.main.%s'%(n,tag)).read().strip() if os.path.exists(R+'/r2/out/%s.main.%s'%(n,tag)) else ''
    vh=verdict(h)[0] if h else '-'; vm=verdict(m)[0] if m else '-'
    v1=verdict(r1[n])[0] if n in r1 else '-'
    flag=[]
    if tag=='r1' and v1!=vh: flag.append('CHANGED-since-r1')
    if 'DIFFER' in vh: flag.append('MISMATCH-head')
    print('%-45s r1=%-28s head=%-28s main=%-28s %s'%(n,v1,vh,vm,' '.join(flag)))
