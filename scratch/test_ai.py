import os
import sys
from pathlib import Path

# Add project root to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app import allowed_file, app, AI_PROVIDERS

print("--- TESTING HELPER FUNCTIONS ---")
print("allowed_file('script.py'):", allowed_file('script.py'))
print("allowed_file('project.tar.gz'):", allowed_file('project.tar.gz'))
print("allowed_file('archive.zip'):", allowed_file('archive.zip'))

assert allowed_file('script.py') == True
assert allowed_file('project.tar.gz') == True
assert allowed_file('archive.zip') == True

print("\n--- TESTING PROVIDER REGISTRY ---")
for k, v in AI_PROVIDERS.items():
    print(f"Provider '{k}': {v['name']} ({v['model']}) -> Env Key: {v['env_key']}")

print("\n--- ALL HELPERS PASSED SUCCESSFULLY! ---")
