import json, sys, math, xml.etree.ElementTree as ET
from pathlib import Path

def cross(a,b,c):
    return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])

def intersections(a,b):
    return any(cross(p,q,r)*cross(p,q,s)<0 and cross(r,s,p)*cross(r,s,q)<0
               for p,q in zip(a,a[1:]) for r,s in zip(b,b[1:]))

def contains(ring,p):
    x,y=p
    for a,b in zip(ring,ring[1:]):
        if abs(cross(a,b,p))<1e-14 and min(a[0],b[0])<=x<=max(a[0],b[0]) and min(a[1],b[1])<=y<=max(a[1],b[1]): return True
    return sum((a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0] for a,b in zip(ring,ring[1:]))%2==1

def area(r):
    x,y=r[0]
    return sum((a[0]-x)*(b[1]-y)-(b[0]-x)*(a[1]-y) for a,b in zip(r,r[1:]))/2

def load(file,boundary_id):
    root=ET.parse(file).getroot()
    if root.tag!='osm': raise ValueError('Expected OSM root')
    nodes={n.attrib['id']:[float(n.attrib['lat']),float(n.attrib['lon'])] for n in root.findall('node')}
    assert len(nodes)==len(root.findall('node'))
    assert all(math.isfinite(x) and -90<=x<=90 and math.isfinite(y) and -180<=y<=180 for x,y in nodes.values())
    ways={}
    for w in root.findall('way'):
        wid=w.attrib['id']
        assert wid not in ways
        ways[wid]=([nodes[n.attrib['ref']] for n in w.findall('nd')],{t.attrib['k']:t.attrib['v'] for t in w.findall('tag')})
    boundary=ways[boundary_id][0]
    def polygon(r):
        return len(r)>=4 and r[0]==r[-1] and len(set(map(tuple,r[:-1])))==len(r)-1 and abs(area(r))>1e-14 and not intersections(r,r)
    assert polygon(boundary)
    def inside(r):
        return polygon(r) and all(contains(boundary,p) for p in r) and not intersections(boundary,r)
    return ways,boundary,inside,nodes

source=Path(sys.argv[1])
result={}
for key,file,bid,label,address in [
 ('pioneer','pioneer_campus.osm','1584511957','Pioneer Campus','Plot 37413, off Alick Nkhata Road, Mass Media, Lusaka'),
 ('leopards','leopards_hill_campus.osm','842714813','Leopards Hill Campus','Plot 17986, off Leopards Hill Road, Lusaka')]:
    ways,boundary,inside,nodes=load(source/file,bid)
    campus=dict(label=label,available=True,center=[sum(p[i] for p in boundary[:-1])/len(boundary[:-1]) for i in (0,1)],zoom=18,boundary=boundary,description=address,buildings=[],footprints=[],lines=[],directory=[],osmBoundary=bid)
    candidates=[(wid,r) for wid,(r,t) in ways.items() if 'building' in t and inside(r)]
    seen=set()
    for wid,r in sorted(candidates,key=lambda item:-abs(area(item[1]))):
        if key=='pioneer' and int(wid) in range(1584511958,1584511977) and wid not in {'1584511960','1584511969','1584511971','1584511973'}: continue
        signature=frozenset(map(tuple,r))
        if signature in seen or any(intersections(other['ring'],r) or all(contains(other['ring'],p) for p in r) for other in campus['footprints']): continue
        seen.add(signature)
        campus['footprints'].append(dict(osmWay=wid,ring=r))
    def anchor(slug,name,wid,description):
        r=ways[wid][0]
        if not all(contains(boundary,p) for p in r): return None
        points=r[:-1] if r[0]==r[-1] else r
        center=[sum(p[i] for p in points)/len(points) for i in (0,1)]
        if len(r)>=4 and r[0]==r[-1] and not contains(r,center): center=points[0]
        ident=key+'-'+slug
        campus['buildings'].append(dict(id=ident,name=name,coordinates=center,description=description,category='academic',facilities=[],gallery=[],osmWay=wid))
        return ident
    def add(slug,name,floor,building,marker=None,aliases=(),note=''):
        campus['directory'].append(dict(id=key+'-'+slug,name=name,floor=floor,building=building,anchor=marker,aliases=list(aliases),note=note))
    def room(n,floor,building,marker=None,name=None,aliases=(),note=''):
        add('room-'+str(n),name or 'Room '+str(n),floor,building,marker,('room '+str(n),'lecture room '+str(n),*aliases),note)
    if key=='pioneer':
        a,b,c='Main Academic Block','Inner Building / Cafeteria Block','Academic and Administration Block'
        aa=anchor('main',a,'1584511960','Approximate block anchor. Ground floor short wing: 3, 2. Long wing: 4, 5, 6. First floor long wing: 11, 10, 9, 8, 7. Short wing: 16, 15, 14, 13, 12. Sequences follow the private annotation orientation.')
        bb=anchor('inner',b,'1584511969','Approximate block anchor.')
        cc=anchor('admin',c,'1584511973','Approximate block anchor.')
        rear=anchor('rear','Rear classrooms','1584511971','Rear section of the Academic and Administration Block.')
        r32=anchor('rear-32','Rear classroom building','1061989323','Building anchor for Room 32.')
        for n in [3,2,4,5,6,11,10,9,8,7,16,15,14,13,12]:
            wing='short' if n in [2,3,12,13,14,15,16] else 'long'
            room(n,int(n>=7),a,aa,note=wing.capitalize()+' wing.'+(' At the far end above the toilets.' if n==7 else ''))
        for n in range(18,28):
            names={19:'Room 19 — Sick Bay',21:'Room 21 — Enquiries and IT Department'}
            aliases={19:('sick bay',),21:('enquiries','it department')}
            room(n,int(n>=22),b,bb,names.get(n),aliases.get(n,()))
        room(17,0,c,cc,'Room 17 — Computer Lab',('computer lab','computer lab 17'))
        for n in range(28,32): room(n,0,c,rear,note='Rear classroom section.')
        room(32,1,c,r32,note='Rear classroom section.')
        for block,marker,names in [(a,aa,["Postgraduate Office","Counsellor's Office","Ladies' toilets","Gents' toilets","Lost & Found"]),(b,bb,['Cafeteria']),(c,cc,['Academic Office','Accounts Office','Registrar','Procurement Office','Library',"Ladies' toilets","Gents' toilets",'Knowledge Base 1','Knowledge Base 2'])]:
            for name in names:
                slug=(marker or 'unknown')+'-'+''.join(ch.lower() if ch.isalnum() else '-' for ch in name).strip('-')
                aliases={'Accounts Office':['accounts'],'Lost & Found':['lost and found']}.get(name,[])
                add(slug,name,int(name.startswith('Knowledge Base')),block,marker,aliases)
        gate=anchor('gate','Main gate','1584511970','Mapped gate feature.')
        add('main-gate','Main gate',None,label,gate)
        add('car-park','Car park',None,label,note='Campus parking is reported. Its outline is unverified.')
    else:
        for n,f in [(3,0),(2,1),(1,2)]: room(n,f,'Old Building')
        for n in [8,9,10,11,12,16,13,15,18]:
            room(n,int(n in [13,15,18]),'New Building',name='Room 18 — Computer Lab' if n==18 else None,aliases=('computer lab 18','computer lab') if n==18 else ())
        room(7,None,None,note='Historically listed on the ground floor of New Building.')
        room(14,None,None)
        for name,building,note in [('Old Examination Hall','Old Building','Historical building association.'),('New Examination Hall','New Building',''),('Library',None,''),('Cafeteria',None,''),('School of Law',None,'Campus-level school reference. Its building is unconfirmed.')]:
            add(name.lower().replace(' ','-'),name,None,building,note=note)
        park=anchor('parking','Car park','1008269678','Mapped parking area.')
        add('car-park','Car park',None,label,park)
        campus['schoolReference']={'osmNode':'5491816274','coordinates':nodes['5491816274']}
        for wid in ['842714815','1008269679','1008269680']:
            campus['lines'].append(dict(osmWay=wid,points=ways[wid][0]))
    by_anchor={b['id']:b for b in campus['buildings']}
    for row in campus['directory']:
        if row['anchor']: by_anchor[row['anchor']]['facilities'].append(row)
    campus['sources']=[f'https://www.openstreetmap.org/way/{bid}','https://web.unilus.ac.zm/aboutunilus/']
    campus['directorySource']='Firsthand campus handoff, 25 November 2026' if key=='pioneer' else 'UNILUS retained venue directory and campus tour'
    result[key]=campus
Path(sys.argv[2]).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
for key,c in result.items(): print(key,len(c['footprints']),len(c['directory']),len(c['buildings']))
