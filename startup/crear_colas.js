#!/usr/bin/env node

var shell = require('./shell')
var async = require('async');

console.log("creando colas");

async.series([
  function(callback) {
    shell.execCommand("node crear_cola.js compras", function (returnvalue) {
                              callback(null, "cola compras creada");
                            })
  },
  function(callback) {
    shell.execCommand("node crear_cola.js envios", function (returnvalue) {
                              callback(null, "cola envios creada");
                            })
  },
  function(callback) {
    shell.execCommand("node crear_cola.js Publicaciones", function (returnvalue) {
                              callback(null, "cola Publicaciones creada");
                            })
  },
  function(callback) {
    shell.execCommand("node crear_cola.js pagos", function (returnvalue) {
                              callback(null, "cola pagos creada");
                            })
  },
  function(callback) {
    shell.execCommand("node crear_cola.js publicaciones", function (returnvalue) {
                              callback(null, "cola publicaciones creada");
                            })
  },
  function(callback) {
    shell.execCommand("node crear_cola.js web", function (returnvalue) {
                              callback(null, "cola web creada");
                            })
  }
],
// optional callback
function(err, results) {
  console.log(results);
  process.exit(0);
});
