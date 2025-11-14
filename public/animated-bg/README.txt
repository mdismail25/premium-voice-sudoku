
Butterfly Patch Package
=======================

Files:
- butterfly.css
- butterfly.js
- patch_bg.ps1   (PowerShell script to apply patch)
- patch_bg.sh    (bash script to apply patch)
- README.txt     (this file)

How to apply (Windows PowerShell):
1. Copy the contents of this folder into your project's public folder (where index.html and style.css are).
   Example: copy files to C:\path\to\project\public\assets\bg\  (or into project public root)
2. Run the PowerShell patch script from the project public folder (it will create assets/bg and update index.html):
   Open PowerShell in the public folder and run:
     .\patch_bg.ps1
3. Start your server and open http://localhost:3000 to see the neon butterflies.

How to apply (Linux / macOS):
1. Copy files into your project's public folder.
2. Run:
     bash ./patch_bg.sh
