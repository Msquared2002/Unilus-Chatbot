"""Blender 4.2: repeatable, editable UNILUS V1. Run with blender --background --python this.py."""
import bpy, math, random, json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent
random.seed(47)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    if collection.name != 'Collection': bpy.data.collections.remove(collection)
collection = bpy.data.collections.get('Collection')
collection.name = 'UNILUS editable mascot'

def material(name, color, roughness=.5, metallic=0):
    m = bpy.data.materials.new(name); m.diffuse_color = (*color, 1); m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    return m

body_mat = material('Deep charcoal | gentle highlights', (.018,.020,.022), .43)
cap_mat = material('Black mortarboard', (.012,.014,.016), .5)
cap_mat.node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.2
gold = material('UNILUS gold', (.95,.61,.035), .37, .22)
white = material('Eye white', (.98,.98,.98), .3)
hair_mat = material('Low Afro | dark curls', (.025,.020,.018), .91)
fabric = material('Spirit hoodie | black fabric', (.018,.019,.021), .95)
rope_mat = material('Cotton drawstrings', (.85,.86,.84), .9)

def empty(name, parent=None, location=(0,0,0)):
    obj = bpy.data.objects.new(name, None); collection.objects.link(obj)
    obj.empty_display_type = 'PLAIN_AXES'; obj.empty_display_size = .2
    obj.parent = parent; obj.location = location
    return obj

def finish(obj, name, mat, parent):
    obj.name = name; obj.parent = parent
    if mat: obj.data.materials.append(mat)
    if obj.type == 'MESH':
        for poly in obj.data.polygons: poly.use_smooth = True
    return obj

def sphere(name, loc, scale, mat, parent, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj=bpy.context.object; obj.scale=scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj,name,mat,parent)

def cube(name,loc,scale,mat,parent,bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    obj=bpy.context.object;obj.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=obj.modifiers.new('Soft tailored edges','BEVEL');mod.width=bevel;mod.segments=2
        bpy.ops.object.modifier_apply(modifier=mod.name)
        mod=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL')
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj,name,mat,parent)

def tube(name,points,radius,mat,parent):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D'
    curve.resolution_u=12;curve.bevel_depth=radius;curve.bevel_resolution=2
    spline=curve.splines.new('BEZIER');spline.bezier_points.add(len(points)-1)
    for b,p in zip(spline.bezier_points,points):
        b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);collection.objects.link(obj)
    bpy.context.view_layer.objects.active=obj;obj.select_set(True)
    bpy.ops.object.convert(target='MESH');obj=bpy.context.object
    obj.select_set(False)
    return finish(obj,name,mat,parent)

root=empty('AvatarRoot')
head=empty('HeadMotionPivot',root)
root['reference']='Existing 78px spherical avatar; no limbs, mouth, nose or neck'
body=sphere('BodyMesh',(0,0,0),(1,1,1),body_mat,head,48,32)
eyes=empty('Eyes',head)
for side,x in [('Left',-.385),('Right',.385)]:
    pivot=empty(side+'EyePivot',eyes,(x,-.885,.345))
    sphere(side+'Eye',(0,0,0),(.205,.092,.244),white,pivot,24,16)

cap=empty('GraduationCap',head)
bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.49,depth=.32,location=(0,0,1.065))
finish(bpy.context.object,'CapCrown',cap_mat,cap)
board=cube('Mortarboard',(0,0,1.25),(1.25,1.25,.065),cap_mat,cap,.015)
board.rotation_euler.z=math.radians(32)
# Gold lettering is editable text in the .blend; a mesh copy is exported.
text_curve=bpy.data.curves.new('UNILUS editable lettering','FONT')
text_curve.body='UNILUS';text_curve.align_x='CENTER';text_curve.align_y='CENTER'
text_curve.size=.225;text_curve.extrude=.0015;text_curve.bevel_depth=.0005
text=bpy.data.objects.new('CapLettering',text_curve);collection.objects.link(text)
text.parent=cap;text.location=(0,-.16,1.287);text.data.materials.append(gold)
# Text local +Y points towards the back, readable from the front camera.
tassel=empty('Tassel',cap)
tube('GoldCord',[(0,0,1.298),(.46,-.1,1.30),(.81,-.19,1.285),(.82,-.2,.94)],.014,gold,tassel)
sphere('TasselKnot',(.82,-.20,.93),(.04,.04,.055),gold,tassel,16,10)
tube('TasselStem',[(.82,-.20,.91),(.82,-.20,.77)],.015,gold,tassel)
bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.065,radius2=.026,depth=.21,location=(.82,-.20,.67))
finish(bpy.context.object,'GoldTasselFringe',gold,tassel)
for i in range(10):
    a=i*math.tau/10
    tube('FringeStrand_%02d'%i,[(.82+.02*math.cos(a),-.20+.02*math.sin(a),.77),(.82+.06*math.cos(a),-.20+.06*math.sin(a),.57)],.003,gold,tassel)

hair_anchor=empty('HairAnchor',head)
hair=empty('LowAfro',hair_anchor)
# Rounded curls follow the sphere. The front hairline stays above the eyes;
# side/back curls extend slightly lower, like the approved Low Afro reference.
curls=[]
for row in range(16):
    theta=.10+row*.094
    count=max(6,round(math.tau*math.sin(theta)/.15))
    for i in range(count):
        phi=math.tau*(i+.5*(row%2))/count
        front=max(0,-math.sin(phi))
        if math.cos(theta)<.08+.60*front: continue
        t=theta+random.uniform(-.025,.025);p=phi+random.uniform(-.025,.025)
        r=1.12; loc=(r*math.sin(t)*math.cos(p),r*math.sin(t)*math.sin(p),r*math.cos(t))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=loc)
        obj=bpy.context.object;obj.scale=(.12+random.random()*.025,.12+random.random()*.025,.115+random.random()*.025)
        bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
        finish(obj,'Curl',hair_mat,hair);curls.append(obj)
bpy.ops.object.select_all(action='DESELECT')
for obj in curls:obj.select_set(True)
bpy.context.view_layer.objects.active=curls[0]
bpy.ops.object.join();bpy.context.object.name='LowAfroCurlMesh'
# Continuous undercap prevents any pinhole/scalp gaps between curls.
def spherical_patch(name, parent, mat, rows, columns, point, uv=None):
    vertices=[];faces=[];coords=[]
    for j in range(rows+1):
        for i in range(columns+1):
            u=i/columns;v=j/rows;vertices.append(point(u,v));coords.append(uv(u,v) if uv else (u,v))
    for j in range(rows):
        for i in range(columns):
            a=j*(columns+1)+i;faces.append((a,a+columns+1,a+columns+2,a+1))
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update()
    obj=bpy.data.objects.new(name,mesh);collection.objects.link(obj);finish(obj,name,mat,parent)
    uv_layer=mesh.uv_layers.new(name='UVMap')
    for poly in mesh.polygons:
        for loop in poly.loop_indices:uv_layer.data[loop].uv=coords[mesh.loops[loop].vertex_index]
    return obj

def hair_point(u,v):
    phi=u*math.tau;front=max(0,-math.sin(phi));end=math.acos(.08+.60*front)
    t=.002+v*end;r=1.105
    return (r*math.sin(t)*math.cos(phi),r*math.sin(t)*math.sin(phi),r*math.cos(t))
spherical_patch('LowAfroUnderCap',hair,hair_mat,12,48,hair_point)

outfit_anchor=empty('OutfitAnchor',head)
outfit=empty('BlackSpiritHoodie',outfit_anchor)
def shell_point(u,v):
    phi=u*math.tau;t=math.acos(.055)+v*(math.pi-math.acos(.055)-.006);r=1.018
    return (r*math.sin(t)*math.cos(phi),r*math.sin(t)*math.sin(phi),r*math.cos(t))
shell=spherical_patch('FittedHoodieShell',outfit,fabric,22,64,shell_point)
# Hem/neckline follow the sphere; no human shoulders, sleeves or neck.
neck=[]
for i in range(65):
    a=i*math.tau/64;neck.append((1.019*math.cos(a),1.019*math.sin(a),.055))
tube('SimpleCurvedNeckline',neck,.022,fabric,outfit)
for side,x in [('Left',-.55),('Right',.55)]:
    tube(side+'Drawstring',[(x,-.86,.015),(x*.99,-.88,-.15),(x*.98,-.84,-.36)],.012,rope_mat,outfit)
    cube(side+'Aglet',(x*.98,-.84,-.36),(.035,.03,.065),white,outfit,.008)

# Reuse the actual approved print pixels. UVs select its rectangular front area
# in the existing garment image; neither the U nor UNILUS is redrawn.
image=bpy.data.images.load(str(SOURCE/'outfits/black-spirit-hoodie.png'),check_existing=True)
image.name='Approved Black Spirit Hoodie | original print'
if image.size[0]>1024:
    ratio=1024/image.size[0];image.scale(1024,round(image.size[1]*ratio))
image.pack()
print_mat=material('Approved U + UNILUS texture',(.02,.02,.02),.95)
nodes=print_mat.node_tree.nodes;tex=nodes.new('ShaderNodeTexImage');tex.image=image
print_mat.node_tree.links.new(tex.outputs['Color'],nodes.get('Principled BSDF').inputs['Base Color'])
def decal_point(u,v):
    x=(u-.5)*.70;z=-.28-v*.53;r=1.028
    y=-math.sqrt(max(.001,r*r-x*x-z*z))
    return (x,y,z)
decal=spherical_patch('ApprovedVarsityFrontPrint',outfit,print_mat,18,24,decal_point,
    lambda u,v:(.360+u*.286,1-(.312+v*.636)))
decal['source']='Unchanged approved black-spirit-hoodie.png; front print UV crop'
empty('AccessoryAnchor',head,(0,-1,-.55))
cap.location.z=.18 # Default look: Low Afro fitted beneath the cap.
# Tip the mortarboard towards the viewer, preserving the readable top face
# in the existing reference without forcing a high camera angle on the eyes.
parts=list(cap.children)
cap_tilt=empty('CapTilt',cap,(0,0,1.1))
for part in parts:
    part.parent=cap_tilt;part.location.z-=1.1
cap_tilt.rotation_euler.x=math.radians(12)

# Editable inspection setup, excluded from GLB export.
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.world.color=(.25,.25,.25)
def area(name,loc,power,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size
    o=bpy.data.objects.new(name,data);collection.objects.link(o);o.location=loc
    o.rotation_euler=(Vector((0,0,.3))-o.location).to_track_quat('-Z','Y').to_euler()
area('StudioKey',(-3,-4,5),450,4)
area('StudioFill',(3,-2,2),220,3)
area('StudioRim',(0,3,4),500,3)
bpy.ops.object.camera_add(location=(0,-7,2.5))
camera=bpy.context.object;camera.name='PreviewCamera'
camera.rotation_euler=(Vector((0,0,.3))-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=3.65;scene.camera=camera
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.view_settings.view_transform='AgX'
for screen in bpy.data.screens:
    for a in screen.areas:
        if a.type=='VIEW_3D':
            a.spaces.active.region_3d.view_distance=5
            a.spaces.active.region_3d.view_location=(0,0,.25)
            a.spaces.active.shading.type='MATERIAL'
blend=ROOT/'blender/unilus-avatar-v1.blend'
glb=ROOT/'models/unilus-avatar-v1.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
# Convert editable text only after saving the .blend, for reliable mesh export.
bpy.ops.object.select_all(action='DESELECT');text.select_set(True);bpy.context.view_layer.objects.active=text
bpy.ops.object.convert(target='MESH')
bpy.ops.object.select_all(action='DESELECT')
def select_tree(obj):
    obj.select_set(True)
    for child in obj.children:select_tree(child)
select_tree(root)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,
    export_yup=True,export_animations=False,export_extras=True,export_cameras=False,export_lights=False)
meshes=[o for o in bpy.data.objects if o.type=='MESH' and o.select_get()]
stats={'blender':bpy.app.version_string,'objects':len([o for o in bpy.data.objects if o.select_get()]),
       'meshes':len(meshes),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes),
       'glb_bytes':glb.stat().st_size,'blend_bytes':blend.stat().st_size,
       'anchors':['HairAnchor','OutfitAnchor','AccessoryAnchor']}
(ROOT/'models/model-stats.json').write_text(json.dumps(stats,indent=2))
print('UNILUS_BUILD_OK',json.dumps(stats))
