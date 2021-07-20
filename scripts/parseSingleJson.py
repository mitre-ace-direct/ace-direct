import json
import sys

if len(sys.argv) <= 2:
  print("usage:  " + sys.argv[0] + "  <JSON file path>  <single field to get>  [value to set]")
  print("")
  print("e.g.:   " + sys.argv[0] + "  config.json  common:version")
  print("        " + sys.argv[0] + "  config.json  common:version  9.0")
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

if len(sys.argv) == 3:
  # just output the value
  print(f2[lastfield])
elif len(sys.argv) <= 4:
  # make the change and output the entire JSON
  f2[lastfield] = sys.argv[3]
  print(json.dumps(data, indent=2))
else:
    print()


