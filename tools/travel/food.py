"""Classify restaurant listings by cuisine and by how well they suit each diet.

Signals come from the listing's name and description (Wikivoyage text). Levels:
  'only'   - a dedicated place for that diet (e.g. a vegan restaurant)
  'yes'    - the text says it caters for it (e.g. "vegan options", "halal")
  'likely' - the cuisine usually has good choices for it (Indian for vegetarians,
             seafood for chicken-and-fish eaters); shown as "likely", never as a promise
  'no'     - the place centres on what the diet excludes (a steakhouse for vegetarians)
"""
import re

CUISINES = [  # (label, pattern)
    ('Indian', r'\bindian\b|\btandoori|\bmasala|\bbiryani|\bdosa|\bnaan\b|punjabi|gujarati|south indian|\bthali|paneer|chaat'),
    ('Nepali / Himalayan', r'nepal|himalayan|tibetan|momo'),
    ('Pakistani / Afghan', r'pakistan|afghan|kabob house|\bkarahi'),
    ('Chinese', r'chinese|szechuan|sichuan|cantonese|dim sum|dumpling|hunan|hot ?pot|\bwok\b'),
    ('Japanese', r'japanese|sushi|ramen|izakaya|teriyaki|tempura|udon|hibachi|teppanyaki|omakase'),
    ('Korean', r'korean|bibimbap|bulgogi|\bkbbq|\bbanchan'),
    ('Thai', r'\bthai\b|pad thai|green curry'),
    ('Vietnamese', r'vietnam|\bpho\b|banh mi'),
    ('Filipino', r'filipino|philippine|adobo|lumpia'),
    ('Asian', r'\basian\b|pan-asian|malaysian|indonesian|burmese|singapore|laotian|cambodian'),
    ('Middle Eastern', r'middle eastern|lebanese|falafel|shawarma|hummus|persian|iranian|turkish|kebab|israeli|arab|syrian|yemeni'),
    ('Mediterranean / Greek', r'mediterranean|greek|gyro|souvlaki|taverna'),
    ('Ethiopian / African', r'ethiopian|eritrean|injera|african|nigerian|somali|moroccan'),
    ('Mexican', r'mexican|taco|taquer|burrito|enchilada|tamale|cantina|tex-mex|tortilla|quesadilla|mole\b'),
    ('Latin American', r'latin|cuban|peruvian|salvador|pupusa|colombian|venezuelan|arepa|brazilian|churrascar|argentin|puerto ric|caribbean|jamaican|dominican'),
    ('Italian', r'italian|trattoria|osteria|pasta|risotto|gnocchi'),
    ('Pizza', r'pizz'),
    ('French', r'french|bistro|brasserie|crepe|creperie'),
    ('Spanish / Tapas', r'spanish|tapas|paella'),
    ('German / European', r'german|bavarian|polish|pierogi|czech|hungarian|russian|ukrainian|european|irish pub|british'),
    ('Seafood', r'seafood|fish|oyster|lobster|crab|shrimp|clam|chowder|fish ?(and|&|n) ?chips|poke|ceviche|catfish|crawfish|crayfish'),
    ('Steakhouse', r'steak ?house|steakhouse|\bsteaks?\b|chophouse|prime rib'),
    ('BBQ', r'\bbbq\b|barbecue|barbeque|smokehouse|brisket|pulled pork|ribs\b'),
    ('Burgers', r'burger'),
    ('Chicken', r'fried chicken|chicken wings?|\bwings\b|rotisserie chicken|hot chicken|chicken shack'),
    ('Southern / Soul', r'southern|soul food|cajun|creole|gumbo|jambalaya|po.?boy|grits|biscuits'),
    ('American', r'american|diner|grill\b|comfort food|gastropub|sandwich|deli\b|hot dog'),
    ('Breakfast / Brunch', r'breakfast|brunch|pancake|waffle|omelet|bagel'),
    ('Bakery / Café', r'bakery|bakeries|pastr|donut|doughnut|croissant|caf[eé]\b|coffee'),
    ('Dessert / Ice cream', r'ice cream|gelato|frozen custard|dessert|chocolat|candy|fudge'),
    ('Vegan / Vegetarian', r'\bvegan\b|vegetarian|plant.based|meatless'),
    ('Hawaiian', r'hawaiian|plate lunch|loco moco|spam musubi|shave ice'),
]
CUISINES = [(l, re.compile(p, re.I)) for l, p in CUISINES]

R = lambda p: re.compile(p, re.I)
VEGAN_ONLY = R(r'(all|100%|fully|entirely|completely|strictly|exclusively)[ -]?vegan|vegan (restaurant|caf[eé]|bakery|diner|eatery|kitchen|joint|spot|place|food truck|deli|bistro)|plant.based (restaurant|caf[eé]|eatery|kitchen)')
VEG_ONLY = R(r'(all|100%|fully|entirely|completely|strictly|exclusively|pure)[ -]?vegetarian|vegetarian (restaurant|caf[eé]|eatery|kitchen|thali)|meat.free (restaurant|menu)')
VEGAN_YES = R(r'\bvegan\b|plant.based|dairy.free')
VEG_YES = R(r'vegetarian|\bveggie\b|meatless|meat.free|\bpaneer\b|falafel|veg(etable)? (dishes|options|menu)')
GF_YES = R(r'gluten.free|celiac|coeliac')
HALAL = R(r'\bhalal\b|zabiha')
KOSHER = R(r'\bkosher\b')
EGG = R(r'\beggs?\b|omelet|breakfast|brunch|bakery|pancake|waffle|quiche')
REDMEAT_FOCUS = R(r'steak ?house|steakhouse|\bsteaks?\b|chophouse|prime rib|\bbbq\b|barbecue|barbeque|smokehouse|brisket|pulled pork|\bribs\b|burger|hot dog|sausage|bratwurst|pork|bacon|ham\b|lamb|\bbeef\b|carnitas|chorizo|charcuterie|butcher|meatball')
CHICKEN_FISH = R(r'chicken|seafood|fish|shrimp|salmon|tuna|sushi|poke|crab|lobster|oyster|clam|tilapia|catfish|crawfish|wings')

# Cuisines that usually give each diet real choices (shown as "likely", with tips)
LIKELY = {
    'veg': {'Indian', 'Nepali / Himalayan', 'Ethiopian / African', 'Middle Eastern', 'Mediterranean / Greek', 'Thai', 'Italian', 'Pizza', 'Mexican', 'Vegan / Vegetarian', 'Japanese', 'Vietnamese', 'Chinese', 'Korean'},
    'vegan': {'Indian', 'Ethiopian / African', 'Middle Eastern', 'Thai', 'Vietnamese', 'Vegan / Vegetarian'},
    'egg': {'Breakfast / Brunch', 'Bakery / Café'},
    'cf': {'Seafood', 'Chicken', 'Indian', 'Japanese', 'Thai', 'Vietnamese', 'Mediterranean / Greek', 'Middle Eastern', 'Mexican', 'Chinese', 'Korean', 'Southern / Soul', 'Pakistani / Afghan', 'Nepali / Himalayan'},
    'fish': {'Seafood', 'Japanese', 'Mediterranean / Greek', 'Thai', 'Vietnamese'},
}
MEATY = {'Steakhouse', 'BBQ', 'Burgers'}


def classify(L):
    txt = (L.get('n', '') + ' . ' + L.get('alt', '') + ' . ' + re.sub(r'<[^>]+>', ' ', L.get('c', '')))
    cu = [lab for lab, rx in CUISINES if rx.search(txt)]
    if L.get('k') == 'drink' and not cu: cu = ['Bar / Café']
    d = {}
    name = L.get('n', '') + ' ' + L.get('alt', '')
    meat_name = bool(re.search(r'beef|bbq|barbe?cue|steak|burger|\bribs?\b|pork|sausage|hot ?dog|brisket|smokehouse|chophouse|meat|wiener|bratwurst|carnitas|chicken|wings', name, re.I))
    # vegan
    if VEGAN_ONLY.search(txt): d['vegan'] = 'only'
    elif VEGAN_YES.search(txt): d['vegan'] = 'yes'
    elif set(cu) & LIKELY['vegan'] and not meat_name: d['vegan'] = 'likely'
    # vegetarian (no eggs)
    if d.get('vegan') == 'only' or VEG_ONLY.search(txt): d['veg'] = 'only'
    elif VEG_YES.search(txt) or d.get('vegan') == 'yes': d['veg'] = 'yes'
    elif meat_name or set(cu) & MEATY: d['veg'] = 'limited' if set(cu) & LIKELY['veg'] else 'no'
    elif set(cu) & LIKELY['veg']: d['veg'] = 'likely'
    # eggs + vegetarian
    if d.get('veg') in ('only', 'yes'): d['egg'] = d['veg'] if d['veg'] == 'yes' else 'yes'
    elif EGG.search(txt) or set(cu) & LIKELY['egg']: d['egg'] = 'likely' if d.get('veg') != 'no' else 'no'
    elif d.get('veg') == 'likely': d['egg'] = 'likely'
    elif d.get('veg') == 'no': d['egg'] = 'no'
    # chicken & fish only (no red meat / pork)
    meat_focus = bool(set(cu) & {'Steakhouse', 'BBQ'}) or bool(re.search(r'beef|steak|\bribs?\b|pork|brisket|hot ?dog|sausage|bratwurst|carnitas', name, re.I))
    if CHICKEN_FISH.search(txt) and not meat_focus: d['cf'] = 'yes'
    elif set(cu) & LIKELY['cf'] and not meat_focus: d['cf'] = 'likely'
    elif meat_focus or ('Burgers' in cu and not CHICKEN_FISH.search(txt)): d['cf'] = 'no'
    elif d.get('veg') in ('only', 'yes', 'likely'): d['cf'] = 'likely'
    # pescatarian (fish, no meat)
    if re.search(r'seafood|fish|sushi|oyster|lobster|crab|poke', txt, re.I) and not meat_focus: d['fish'] = 'yes'
    elif d.get('veg') in ('only', 'yes'): d['fish'] = 'yes'
    elif set(cu) & LIKELY['fish']: d['fish'] = 'likely'
    elif meat_focus: d['fish'] = 'no'
    # a mixed menu (pizza + ribs) still usually has something: soften 'no' to 'limited'
    if set(cu) - {'Steakhouse', 'BBQ', 'Burgers'}:
        for k in ('cf', 'fish'):
            if d.get(k) == 'no': d[k] = 'limited'
    # a sit-down restaurant with no clear signal usually has a few options: say 'limited', never more
    if L.get('k') == 'eat':
        d.setdefault('veg', 'limited'); d.setdefault('egg', 'limited' if d['veg'] != 'no' else 'no')
        d.setdefault('cf', 'likely' if set(cu) & {'American', 'Southern / Soul', 'Breakfast / Brunch', 'German / European', 'French'} or not cu else 'limited')
        d.setdefault('fish', 'limited')
    # extras
    if GF_YES.search(txt): d['gf'] = 'yes'
    if HALAL.search(txt): d['halal'] = 'yes'
    if KOSHER.search(txt): d['kosher'] = 'yes'
    return cu[:3], d


def price_tier(L, section_h3=''):
    t = (section_h3 or '').lower()
    if 'splurge' in t or 'fine' in t or 'upscale' in t: return 3
    if 'mid' in t or 'moderate' in t: return 2
    if 'budget' in t or 'cheap' in t or 'inexpensive' in t: return 1
    m = re.findall(r'\$\s?(\d{1,3})', L.get('pr', ''))
    if m:
        v = max(int(x) for x in m)
        return 1 if v <= 15 else 2 if v <= 35 else 3
    if re.fullmatch(r'\$+', (L.get('pr') or '').strip()): return min(3, len(L['pr'].strip()))
    return 0


TIPS = {
    'vegan': ['Ask whether beans, rice or tortillas are cooked with lard or chicken stock (common in Mexican and Southern cooking).',
              'Thai and Vietnamese dishes often use fish sauce; ask for soy sauce instead.',
              'Naan and many Indian curries use ghee, butter, cream or yogurt; ask for oil-based dishes like chana masala or aloo gobi.',
              'Ethiopian veggie combos (shiro, misir, gomen) are usually vegan on fasting days and widely available.'],
    'veg': ['Ask whether soups, rice and sauces use chicken or beef stock.',
            'Caesar dressing and Worcestershire sauce contain anchovies; gelatin hides in desserts.',
            'Refried beans can be made with lard; tamales sometimes with lard in the masa.',
            'Pizza, Indian, Middle Eastern and Mediterranean places almost always have real options.'],
    'egg': ['Eggs are easy at breakfast, diners and bakeries; omelettes, egg sandwiches and frittatas are everywhere.',
            'Check sauces and fillings for meat stock, like a vegetarian.',
            'Many baked goods and fresh pasta contain egg, which suits you.'],
    'cf': ['Ask what the burger, sausage or meatballs are made of; turkey and chicken versions exist but beef and pork are the default.',
           'Pepperoni, sausage and bacon are the default pizza meats; grilled chicken is usually available.',
           'Collard greens, beans and soups in the South are often cooked with ham or bacon.',
           'Chili, gravies and many stews are beef-based; ask before ordering.'],
    'fish': ['Sushi, poke, fish tacos and seafood shacks are your safest bets.',
             'Ask whether soups and rice use chicken or beef stock.',
             'Clam chowder may include bacon; ask for it without.'],
}
