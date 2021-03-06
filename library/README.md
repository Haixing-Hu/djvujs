# DjVu.js Library

The file contains some information about inner structure of the project. It may be useful for you, if you want to play with code or contribute to the project. 

It's implied that you have run `npm install` and all dependencies are installed correctly.

## The structure

There are the following directories: 

- `app`  - contains an old application, which is poorly maintained now. It can split a djvu file, convert images to a document, and show metadata of a document. 
- `assets` - contains test .djvu files and images. They are used in the automatic tests. 
- `css` - contains .css files for debug and test pages.
- `dist` - a directory where the final bundle file is saved to (the eventual `djvu.js` file).
- `js` - a folder with different debug, test and old scripts which are not a part of the library, but used for debugging. 
- `src` - a main directory, containing the source code of the library. Its inner structure is self-descriptive, at least I think so. 
- `tests` - a directory containing tests, which are run in a browser. 

There are the following npm commands that may be run: 

- `start` - starts a local static server and runs a rollup watch command, which build the library and rebuild it on each change. Also, on each change of the bundle or a file from `js` folder, the server sends a message to a client script to reload the page. 
- `watch` - just runs a rollup watch method, which builds the library and rebuilds it on each change.
- `build` - just builds the library once. 

So if you don't know what to start with, run `npm start` and head to `http://localhost:9000/` - you will see the old app.  
`http://localhost:9000/sync.html` - is a debug page, which I use most often. 

If you decide to create your own debug page I suggest you to add a `js/reloader.js` script to your page, as it's done in case of `tests.html` and other pages, and your page will be reloaded on each change of the library source code. 

## Tests

There are some automatic tests. In order to run them you should run `npm start` and then open `http://localhost:9000/tests.html`. 

The tests are run automatically when the page loads. If everything is ok, you will see that all messages are green. If you see a green message with an orange message, it means that a test has passed, but your browser differs from mine. The thing is that different browsers differently render `.png` files, which are used for tests. So I use Opera, and all tests pass well in my case. In case of other browsers there may be some problems. So, if you use Mozilla, you should write `about:config` in the address line and then find the parameter `gfx.color_management.mode` and set it to `0`. After it, all tests should be green, except for one, which has an orange message as well. 

When you change the source code of the library, you may open the tests page (which reloads automatically) and check whether your changes break the current functionality or not. 

## Build process

The library is built with Rollup. I chose it rather than Webpack, since Rollup creates a very simple and light bundle (eventually it just copies all classes in one file in right order and wrap them with an anonymous function). 

All files are es6 modules with corresponding import and export statements. So when you create a new file, it's automatically added to the bundle (if you import something from it to the other files). 