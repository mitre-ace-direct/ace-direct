import json
import sys
if len(sys.argv) < 5:
  print("usage:  " + sys.argv[0] + "  <JSON file path>  <array field> <element index>  <field name> [value to set]")
  print("")
  print("e.g.:   " + sys.argv[0] + "  config.json  videomail:agents 0 sipPass")
  print("        " + sys.argv[0] + "  config.json  videomail:agents 0 sipPass abcxyz")
  print("")
  sys.exit()

# read JSON file
f = open(sys.argv[1],)

# load JSON file
data = json.load(f)

# navigate through the colons to find the last dictionary
fields=sys.argv[2].split(':')
f2 = data
lastfield = ''
for i in range(0, len(fields)-1):
  f2 = f2[fields[i]]
  lastfield = fields[i+1]

if lastfield == '':
  print()
  sys.exit()

if len(sys.argv) == 5:
  # just output the value
  print(f2[lastfield][int(sys.argv[3])][sys.argv[4]])
elif len(sys.argv) <= 6:
  # make the change and output the entire JSON
  f2 = f2[lastfield][int(sys.argv[3])]
  f2[sys.argv[4]] = sys.argv[5]
  print(json.dumps(data, indent=2))
else:
    print()


