var child_process = require('child_process');
var pathServer = require('./path_server.json').server;

var child_srv_web = null;
var child_srv_compras = null;
var child_srv_infracciones = null;
var child_srv_pagos = null;
var child_srv_envios = null;
var child_srv_publicaciones = null;

var AdministratorServers = function () {

    // levanta el servidor especificado
    this.initServer = function(name_server, modo){
      var child_created = upServer(name_server, modo);

      if(child_created != null){
        asignChildServer(name_server, child_created);
        console.log("[adminServers]: Servidor web creado con pid: "+child_created.pid);
      }
        
    }

    // detiene el servidor dado
    this.stopServer = function(name_server){
      var child_server = getChildServer(name_server);

      if(child_server != null){
        console.log("[adminServers]: Encontro el child del server con pid "+child_server.pid);
        // child_server.kill("SIGTERM");
        killerChildByPid(child_server.pid);
        killerChildByPid(child_server.pid + 1);
      }
    }
}

module.exports = AdministratorServers;

// ###############################################################
// ###################### FUNCIONES PRIVADAS #####################

// modo: normal o step
function upServer(nameServer, modo){
  var path = getPathServer(nameServer);

  // no se encontro el servidor
  if(path == null){
    return path;
  }

  // console.log("Path servidor: "+path);

  var cmd = "node "+path+" "+modo;

  var child = child_process.exec(cmd, function(error, stdout, stderr){
      console.log("[o]: Desplegado Servidor : "+nameServer.toUpperCase()+"\n [>] Salida: "+stdout);
      if (error !== null) {
        // ################## maquillar esto ##################
          // console.log('Exec ejecucion error: ', error);
          console.log('[X]: Se termino el proceso del servidor '+nameServer.toUpperCase());
      }
  });

  return child;
}

function getPathServer(nameServer){
  var path = null;

  switch (nameServer) {
    case 'compras':
      path = pathServer.compras;
      break;
    case 'publicaciones':
      path = pathServer.publicaciones;
      break;
    case 'web':
      path = pathServer.web;
      break;
    case 'infracciones':
      path = pathServer.infracciones;
      break;
    case 'pagos':
      path = pathServer.pagos;
      break;
    case 'envios':
      path = pathServer.envios;
      break;
    default:
      console.log("Servidor desconocido");
      break;
  }

  return path;
}

// le asigna el proceso creado a su variable correspodiente
function asignChildServer(nameServer, child_created){
  
    switch (nameServer) {
      case 'compras':
        child_srv_compras = child_created;
        break;
      case 'publicaciones':
        child_srv_publicaciones = child_created;
        break;
      case 'web':
        child_srv_web = child_created;
        break;
      case 'infracciones':
        child_srv_infracciones = child_created;
        break;
      case 'pagos':
        child_srv_pagos = child_created;
        break;
      case 'envios':
        child_srv_envios = child_created;
        break;
    }
  
  }

// mata un child por su pid
function killerChildByPid(pid_child){
  var cmd = "kill -9 "+pid_child;
  child_process.exec(cmd, function(error, stdout, stderr){
    console.log("Se finalizo el proceso con pid: "+pid_child);
    if (error !== null) {
        console.log('Exec ejecucion error: ', error);
    }
});
}

  // le asigna el proceso creado a su variable correspodiente
function getChildServer(nameServer){

  var child_server = null;
  
  switch (nameServer) {
    case 'compras':
      child_server = child_srv_compras;
      break;
    case 'publicaciones':
      child_server = child_srv_publicaciones;
      break;
    case 'web':
      child_server = child_srv_web;
      break;
    case 'infracciones':
      child_server = child_srv_infracciones;
      break;
    case 'pagos':
      child_server = child_srv_pagos;
      break;
    case 'envios':
      child_server = child_srv_envios;
      break;
  }

  return child_server;
}