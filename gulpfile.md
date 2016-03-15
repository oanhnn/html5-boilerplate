# Modifying `gulpfile.js` :raised_hands:

There are seven variables that you can modify in order to easily adapt the behaviour
of the Gulp file to your own needs.

## Constants

**`BUILD_PATH`** your build folder's path, change it if you wish to rename the default folder. 

Default: `./build/`

***

**`SCRIPTS_PATH`** should be contained inside the build folder, used to store Javascript files. 

Default: `BUILD_PATH + '/js'`

***

**`STYLES_PATH`** should be contained inside the build folder, used to store Javascript files.

Default: `BUILD_PATH + '/css'`

***

**`SOURCE_PATH`** your source code folder's path (the place where all your ES6 files are located). 

Default: `./src`

***

**`STATIC_PATH`** your static files folder's path (the place where all your HTML and CSS is located). 

Default: `./static`

***

**`ENTRY_FILE`** the main source file, by convention named `main.js`.

Default: `SOURCE_PATH + '/main.js'`

***

**`OUTPUT_FILE`** the name of the output transpiled file. 

Default: `app.js`

***

*Any other modification must be done manually to the correct Task.*