"""Reopen the saved editable project, then independently import its exported GLB."""
import bpy, json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
bpy.ops.wm.open_mainfile(filepath=str(root/'blender/unilus-avatar-v1.blend'))
assert bpy.data.objects['BodyMesh'].type=='MESH'
assert bpy.data.objects['CapLettering'].type=='FONT', 'Editable lettering was lost'
assert bpy.data.objects['LeftEye'].parent.name=='LeftEyePivot'
assert bpy.data.objects['LowAfro'].parent.name=='HairAnchor'
assert bpy.data.objects['BlackSpiritHoodie'].parent.name=='OutfitAnchor'
assert bpy.data.objects['BodyMesh'].parent.name=='HeadMotionPivot'
assert all(i.packed_file for i in bpy.data.images if i.source=='FILE' and i.type=='IMAGE')
blend_objects=len(bpy.data.objects)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(root/'models/unilus-avatar-v1.glb'))
for name in ['AvatarRoot','HeadMotionPivot','BodyMesh','LeftEye','RightEye','GraduationCap','LowAfro','BlackSpiritHoodie']:
    assert name in bpy.data.objects,name
assert bpy.data.objects['BodyMesh'].type=='MESH'
report={'blend_reopened':True,'editable_text':True,'packed_textures':True,'glb_reimported':True,'blend_objects':blend_objects,'glb_objects':len(bpy.data.objects),'blender':bpy.app.version_string}
(root/'verification/blender-validation.json').write_text(json.dumps(report,indent=2))
print('UNILUS_VALIDATION_OK',json.dumps(report))
