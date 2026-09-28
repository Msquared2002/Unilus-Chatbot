"""Import the curated 2026-09-27 Silverest photos from the user's ZIP."""
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ZIP = Path(r'C:\Users\mjluk\Desktop\silverest campus pics.zip')
BASE = ROOT / 'dummy environment/chatbot-widget/campus-data'
DOCS = ROOT / 'backend/data/documents/campus'
PREFIX = 'WhatsApp Image 2026-09-27 at '
GROUPS = {
 'unilus_library':['3.03.05 PM (1)','3.03.05 PM (2)'],
 'the_growcery':['3.03.05 PM'],
 'cafeteria_school_of_medicine':['3.03.06 PM (1)','3.03.06 PM','3.03.11 PM (1)'],
 'unilus_gym':['3.03.26 PM (2)','3.03.13 PM (2)','3.03.14 PM','3.03.17 PM','3.03.20 PM','3.03.22 PM'],
 'unilus_swimming_pool':['3.03.23 PM (1)','3.03.23 PM'],
 'unilus_basketball_court':['3.03.24 PM (1)','3.03.25 PM (1)'],
 'unilus_volleyball_court':['3.03.26 PM (1)'],
 'unilus_tennis_court':['3.03.28 PM'],
 'sports_pitch_soccer':['3.03.29 PM (1)','3.03.30 PM'],
 'running_track_athletics':['3.03.29 PM'],
 'unilus_hostel_school_of_medicine_side':['3.03.31 PM (1)','3.03.30 PM (1)','3.03.31 PM','3.03.37 PM'],
 'knowledge_field_2':['3.03.32 PM (1)','3.03.32 PM'],
 'unilus_chapel':['3.03.34 PM (1)','3.03.33 PM (1)'],
 'p_c_school_of_business':['3.03.33 PM','3.03.34 PM'],
 'school_of_business_hostels':['3.03.34 PM (2)','3.03.35 PM'],
 'unilus_auditorium':['3.03.37 PM (1)','3.03.38 PM'],
 'knowledge_field_1':['3.03.38 PM (1)','3.03.37 PM (2)','3.03.40 PM'],
 'foundation_labs':['3.03.39 PM (1)','3.03.39 PM'],
 'biochemistry_lab':['3.03.40 PM (1)','3.03.41 PM'],
 'basic_science_labs':['3.03.41 PM (1)','3.03.42 PM'],
 'unilus_hospital':['3.03.43 PM (2)','3.03.43 PM (1)','3.03.43 PM (3)','3.03.43 PM'],
}
CATALOG = json.loads((ROOT/'backend/data/campus/campus_place_catalog.json').read_text())
assert set(GROUPS) <= {p['id'] for p in CATALOG['places']}
PRES = BASE/'presentation.json'
presentation = json.loads(PRES.read_text())
provenance = {'observed_date':'2026-09-27','source_archive':ZIP.name,'places':{},'unassigned':['3.03.10 PM.jpeg','3.03.11 PM.jpeg','3.03.27 PM (1).jpeg','3.03.27 PM.jpeg']}
with zipfile.ZipFile(ZIP) as z:
    names = {Path(n).name:n for n in z.namelist()}
    def copy(short, target):
        filename = PREFIX+short+'.jpeg'
        if filename not in names: raise FileNotFoundError(filename)
        target.parent.mkdir(parents=True,exist_ok=True)
        target.write_bytes(z.read(names[filename]))
        return filename
    for place_id, photos in GROUPS.items():
        directory = BASE/'buildings/silverest'/place_id
        files = {}
        for i, short in enumerate(photos):
            dest = 'cover.jpg' if i == 0 else f'gallery-{i:02d}.jpg'
            files[dest] = copy(short,directory/dest)
        entry = presentation['silverest']['places'][place_id]
        entry['cover'] = 'cover'
        entry['gallery'] = [f'gallery-{i:02d}' for i in range(1,len(photos))]
        provenance['places'][place_id] = {'assets':files,'mapping_confidence':'location_sequence' if place_id == 'school_of_business_hostels' else 'user_identified'}
    botanic_dir = BASE/'facilities/botanic_bloom'
    provenance['facilities'] = {'botanic_bloom':{'parent_place_id':'p_c_school_of_business','assets':{'cover.jpg':copy('3.03.36 PM',botanic_dir/'cover.jpg'),'gallery-01.jpg':copy('3.03.36 PM (1)',botanic_dir/'gallery-01.jpg')}}}
PRES.write_text(json.dumps(presentation,indent=2)+'\n')
(BASE/'campus_photo_provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')

def record(stem, title, body, place_ids, source_type, images=None, osm_ref=None):
    DOCS.mkdir(parents=True,exist_ok=True)
    path = DOCS/(stem+'.txt')
    note = ('Observed on campus signage on 27 September 2026; operational details may change. Confirm current information with the facility.' if source_type=='onsite_photo' else 'Recorded from OpenStreetMap tags in the local Silverest export; operational details may change. Confirm current information with the facility.')
    path.write_text(title+'\n'+body.strip()+'\n'+note+'\n',encoding='utf-8')
    meta={'source_type':source_type,'observed_date':'2026-09-27','place_id':place_ids[0],'place_ids':place_ids,'operational_information_may_change':True}
    if images: meta['source_image_filenames']=[PREFIX+s+'.jpeg' for s in images]
    if osm_ref: meta['osm_ref']=osm_ref
    (DOCS/(stem+'.txt.meta.json')).write_text(json.dumps(meta,indent=2)+'\n')

record('gym-facilities-prices','UNILUS Gym and sports facilities prices','Gym: K100 per day; K250 per week; K400 for two weeks; K750 per month; K250 per month for UNILUS and Nankunda staff. Swimming pool: the same rates apply separately, except the daily charge is hourly per individual. Football pitch: K400 per hour. Tennis/netball court: K120 per hour. Basketball court: K200 per hour. Volleyball court: K200 per hour. Running track: K150 per hour per person.',['unilus_gym','unilus_swimming_pool','sports_pitch_soccer','unilus_tennis_court','unilus_basketball_court','unilus_volleyball_court','running_track_athletics'],'onsite_photo',['3.03.11 PM (2)'])
record('gym-etiquette','UNILUS Gym etiquette and notices','Wear appropriate workout attire. Bring a towel and wipe equipment after use. Respect personal space; re-rack weights; remain mindful and alert; follow trainer rules. A person who damages equipment may be held liable for the cost. No publicly played vulgar or verbally inappropriate music. Users must follow their allocated time slot; repeated failures may lead to reassignment. Users may report once daily, for a maximum of two hours. Admission is reserved. Towels are mandatory. Only water is permitted as a beverage.',['unilus_gym'],'onsite_photo',['3.03.11 PM (3)','3.03.12 PM (1)','3.03.12 PM'])
record('gym-timetable','UNILUS fitness programme timetable','Monday 18:00–20:00: body building and calisthenics. Tuesday 06:00–07:00: strength and conditioning, plyometrics, aerobics, ladies-only guided gym class. Wednesday 18:00–20:00: body building and calisthenics. Thursday 18:00–19:00: strength and conditioning; 18:15–19:00: mobility and flexibility. Friday 18:00–20:00: body building and calisthenics. Saturday 07:00–08:00: strength and conditioning, mobility and flexibility, aerobics, plyometrics/jump training. Contact: +260 950 572468. Poster mentions classes commencing on 2 August, without a verified year.',['unilus_gym'],'onsite_photo',['3.03.12 PM (2)'])
record('gym-class-prices','UNILUS fitness class prices','K350 monthly: strength and conditioning, body building, calisthenics. K200 monthly: mobility and flexibility, plyometrics, aerobics. Daily fee: K50. A ladies-only guided gym class is also advertised.',['unilus_gym'],'onsite_photo',['3.03.13 PM'])
record('swimming-pool-rules','UNILUS swimming pool rules','No pets. Do not swim alone. No littering, glass, bottles, food or drink. No running or rough play. Swim at your own risk. Shower before entering the pool. Use the stairs. The floor may be slippery; wear slippers. Remain alert. Management may refuse admission, eject or suspend people who disregard health and safety rules.',['unilus_swimming_pool'],'onsite_photo',['3.03.24 PM'])
record('basketball-rules','UNILUS basketball court rules','Use the court at your own risk. Limit play to one hour when others are waiting. Wear proper attire and shoes. No eating, drinking or smoking. No skateboards, rollerblades or bicycles. No pets. The child age threshold on the photographed sign is unclear, so confirm the current rule with the facility.',['unilus_basketball_court'],'onsite_photo',['3.03.25 PM'])
record('volleyball-rules','UNILUS volleyball court rules','Use the court at your own risk. No food, glass or alcoholic beverages. No pets. No bicycles, rollerblades or skateboards. Proper footwear is required. Children under 12 must be accompanied by an adult. Do not swing or pull on the net or abuse the net or equipment. No smoking. Court hours: 08:00 until dusk.',['unilus_volleyball_court'],'onsite_photo',['3.03.26 PM'])
record('tennis-rules','UNILUS tennis court rules','No black-soled shoes. No skateboards, bicycles, skates or rollerblades. Wear proper attire. Lock the gate after playing. No food or drinks except water. No profanity. Tennis play only.',['unilus_tennis_court'],'onsite_photo',['3.03.28 PM (1)'])
record('hospital-services','University of Lusaka Hospital services','The campus sign says the hospital is open 24/7. Services shown: wards, X-ray, ultrasound, laboratory, pharmacy, mammography and physiotherapy. Contact numbers: +260 974 007 657 and +260 952 828 433. Website shown: www.unilus.ac.zm/hospital.',['unilus_hospital'],'onsite_photo',['3.03.44 PM (1)'])
record('hospital-visiting-hours','University of Lusaka Hospital visiting hours','Morning 06:30–07:30. Lunch time 12:45–13:45. Afternoon 16:30–17:45. Contact: +260 974 007 657; hospital@unilus.ac.zm.',['unilus_hospital'],'onsite_photo',['3.03.44 PM'])
record('botanic-bloom','Botanic Bloom location','Botanic Bloom is a food outlet in the P.C. School of Business area at Silverest Campus. It is a nested facility; map focus is P.C. School of Business. No opening hours or menu have been verified.',['p_c_school_of_business'],'onsite_photo',['3.03.36 PM','3.03.36 PM (1)'])
record('library-osm-hours','Unilus Library opening hours from OpenStreetMap','Monday–Friday 08:00–22:00. Saturday 09:00–22:00. Sunday and public holidays closed.',['unilus_library'],'openstreetmap',osm_ref='way/1395302603')
record('growcery-osm-hours','The Growcery hours and payments from OpenStreetMap','Monday–Sunday 07:00–22:00. OSM tags indicate cash, credit cards, debit cards and app payments are supported.',['the_growcery'],'openstreetmap',osm_ref='way/1558097845')
record('cafeteria-osm-hours','Cafeteria School of Medicine hours from OpenStreetMap','Monday–Friday 08:00–20:30.',['cafeteria_school_of_medicine'],'openstreetmap',osm_ref='relation/19253188')
print(f'Imported {len(GROUPS)} place photo groups and {len(list(DOCS.glob("*.txt")))} campus knowledge files.')
