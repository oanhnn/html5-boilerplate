var fs = require('fs');
var path = require('path');
var del = require('del');
var header = require('gulp-header')
var gulp = require('gulp');
var argv = require('yargs').argv;
var gutil = require('gulp-util');
var source = require('vinyl-source-stream');
var buffer = require('gulp-buffer');
var uglify = require('gulp-uglify');
var gulpif = require('gulp-if');
var exorcist = require('exorcist');
var babelify = require('babelify');
var browserify = require('browserify');
var browserSync = require('browser-sync');

/**
 * Using different folders/file names? Change these constants:
 */
var BUILD_PATH = './build';
var ARCHIVE_PATH = './archive';
var SCRIPTS_PATH = BUILD_PATH + '/js';
var STYLES_PATH = BUILD_PATH + '/css';
var SOURCE_PATH = './src';
var STATIC_PATH = './static';
var ENTRY_FILE = SOURCE_PATH + '/main.js';
var OUTPUT_FILE = 'app.js';

var keepFiles = false;
var pkg = require('./package.json');

// Banner to be placed as header of js build file
var enableHeader = false
var banner =
`/**
* ${pkg.name}
* ${pkg.description}
* Compiled: ${Date()}
* @version v${pkg.version}
* @link ${pkg.homepage}
* @copyright ${pkg.license}
*/
`

// list paths of vendor files
var vendors = {
  //'phaser/dist/phaser.min.js': SCRIPTS_PATH,
  'normalize.css/normalize.css': STYLES_PATH
};

// If not in production mode, add `.map` file and un-compress version
//if (!isProduction()) {
//  vendors['phaser/dist/phaser.map'] = SCRIPTS_PATH;
//  vendors['phaser/dist/phaser.js']  = SCRIPTS_PATH;
//}

/**
 * Simple way to check for development/production mode.
 */
function isProduction() {
  return argv.production;
}

/**
 * Logs the current build mode on the console.
 */
function logBuildMode() {

  if (isProduction()) {
    gutil.log(gutil.colors.green('Running production build...'));
  } else {
    gutil.log(gutil.colors.yellow('Running development build...'));
  }

}

/**
 * Deletes all content inside the './build' folder.
 * If 'keepFiles' is true, no files will be deleted. This is a dirty workaround since we can't have
 * optional task dependencies :(
 * Note: keepFiles is set to true by gulp.watch (see serve()) and reset here to avoid conflicts.
 */
function cleanBuild() {
  if (!keepFiles) {
    del([BUILD_PATH + '/**/*.*', BUILD_PATH + '/*', '!' + BUILD_PATH + '/.gitignore']);
  } else {
    keepFiles = false;
  }
}

/**
 * Copies the content of the './static' folder into the '/build' folder.
 * Check out README.md for more info on the '/static' folder.
 */
function copyStatic() {
  return gulp.src(STATIC_PATH + '/**/*')
    .pipe(gulp.dest(BUILD_PATH));
}

/**
 * Copies required vendor files from the './node_modules/*' folder into the './build/' folder.
 * This way you can call 'npm update', get the latest vendor version and use it on your project with ease.
 */
function copyVendor() {
  var srcList = Object.keys(vendors).map(function (file) {
    return './node_modules/' + file;
  });

  var destPath = function (file) {
    var key = file.path.replace(/^(.*)\/node_modules\//, '');
    return vendors[key];
  };

  return gulp.src(srcList)
    .pipe(gulp.dest(destPath));
}

/**
 * Transforms ES2015 code into ES5 code.
 * Optionally: Creates a sourcemap file 'app.js.map' for debugging.
 *
 * In order to avoid copying Phaser and Static files on each build,
 * I've abstracted the build logic into a separate function. This way
 * two different tasks (build and fastBuild) can use the same logic
 * but have different task dependencies.
 */
function build() {

  var sourcemapPath = SCRIPTS_PATH + '/' + OUTPUT_FILE + '.map';
  logBuildMode();

  return browserify({
    entries: ENTRY_FILE,
    debug: true
  })
    .transform(babelify)
    .bundle().on('error', function (error) {
      gutil.log(gutil.colors.red('[Build Error]', error.message));
      this.emit('end');
    })
    .pipe(gulpif(!isProduction(), exorcist(sourcemapPath)))
    .pipe(source(OUTPUT_FILE))
    .pipe(buffer())
    .pipe(gulpif(isProduction(), uglify()))
    .pipe(gulpif(enableHeader, header(banner)))    
    .pipe(gulp.dest(SCRIPTS_PATH));

}

/**
 * Starts the Browsersync server.
 * Watches for file changes in the 'src' folder.
 */
function serve() {

  var options = {
    server: {
      baseDir: BUILD_PATH
    },
    open: false // Change it to true if you wish to allow Browsersync to open a browser window.
  };

  browserSync(options);

  // Watches for changes in files inside the './src' folder.
  gulp.watch(SOURCE_PATH + '/**/*.js', ['watch:js']);

  // Watches for changes in files inside the './static' folder. Also sets 'keepFiles' to true (see cleanBuild()).
  gulp.watch(STATIC_PATH + '/**/*', ['watch:static']).on('change', function () {
    keepFiles = true;
  });

}

/**
 *
 * Make archive directory
 */
function createArchiveDir() {
  var dir = path.resolve(ARCHIVE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, '0755');
  }
}

/**
 * Make archive file (zip format)
 */
function createArchiveFile(done) {
  var archiveName = path.resolve(ARCHIVE_PATH, pkg.name + '_v' + pkg.version + '.zip');
  var archiver = require('archiver')('zip');
  var files = require('glob').sync('**/*.*', {
    'cwd': BUILD_PATH,
    'dot': false // exclude hidden files
  });
  var output = fs.createWriteStream(archiveName);

  archiver.on('error', function (error) {
    done();
    throw error;
  });

  output.on('close', done);

  files.forEach(function (file) {

    var filePath = path.resolve(BUILD_PATH, file);

    // `archiver.bulk` does not maintain the file
    // permissions, so we need to add files individually
    archiver.append(fs.createReadStream(filePath), {
      'name': file,
      'mode': fs.statSync(filePath)
    });

  });

  archiver.pipe(output);
  archiver.finalize();
}

gulp.task('clean', cleanBuild);
gulp.task('copy:static', ['clean'], copyStatic);
gulp.task('copy:vendor', ['copy:static'], copyVendor);
gulp.task('build', ['copy:vendor'], build);
gulp.task('build:fast', build);
gulp.task('serve', ['build'], serve);
gulp.task('watch:js', ['build:fast'], browserSync.reload); // Rebuilds and reloads the project when executed.
gulp.task('watch:static', ['copy:vendor'], browserSync.reload);
gulp.task('archive:make-dir', createArchiveDir);
gulp.task('archive', ['build', 'archive:make-dir'], createArchiveFile);

/**
 * The tasks are executed in the following order:
 * 'cleanBuild' -> 'copyStatic' -> 'copyVendor' -> 'build' -> 'serve'
 *
 * Read more about task dependencies in Gulp:
 * https://medium.com/@dave_lunny/task-dependencies-in-gulp-b885c1ab48f0
 */
gulp.task('default', ['serve']);