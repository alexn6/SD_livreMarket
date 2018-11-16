var _ = require('underscore');
const ioSock = require('socket.io-client');
var portCompras = require('./properties.json').ports.compras;
var portWeb = require('./properties.json').ports.web;
var portPublicaciones = require('./properties.json').ports.publicaciones;

// ############################################################
// ############### parche para crear compra ###################
var SenderMjes = require('./sendMje');
var factoryMjes = new SenderMjes();

// ############################################################

// require('console-info');
// require('console-error');
// require('console-warn');

//var webIO = ioSock.connect('http://localhost:6002', {reconnect: true});
var webIO = ioSock.connect('http://localhost:'+portWeb, {reconnect: true});
webIO.on('connect', function (sock) {
  console.log('Conectado al Monitor WEB desde DistMonSocJson!!!');
});

//var comprasIO = ioSock.connect('http://localhost:6000', {reconnect: true});
var comprasIO = ioSock.connect('http://localhost:'+portCompras, {reconnect: true});
comprasIO.on('connect', function (sock) {
  console.log('Conectado al Monitor COMPRAS desde DistMonSocJson!!!');
});

//var PublicacionesIO = ioSock.connect('http://localhost:6003', {reconnect: true});
var PublicacionesIO = ioSock.connect('http://localhost:'+portPublicaciones, {reconnect: true});
PublicacionesIO.on('connect', function (sock) {
  console.log('Conectado al Monitor PUBLICACIONES desde DistMonSocJson!!!');
});

var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);

const port = 5557

server.listen(port, function() {
  console.log("Servidor corriendo en http://localhost:"+port);
});

app.use(express.static('public'));

// #################################################################
// ##################### Escuchando Server PUG #####################
// #################################################################

io.on('connection', function(socket) {
  console.log('Alguien se ha conectado con Sockets');

  // mje de estado del servidor
  socket.on('mje-status', function(from, msg) {
    console.log("Se toma el mje <mje-status> del SERVER-PUG");

    var cliente = resolverCliente(from);

    // mandamos el estado correspodiente
    if (cliente != null) {
      console.log("[mje-status]: Mje enviado al monitor-io desde el disMonSocJson");
      cliente.emit('getAllCompras');
    }
    else{
      io.sockets.emit('resp-mje-status','Servidor desconocido:'+from+'\n');
    }

  });

  // mje de siguiente paso
  socket.on('next-step', function(from, idCompra){
    console.log("Se recibio el mje <next-step> del SERVER-PUG");
    var cliente = resolverCliente(from);
    // mandamos el estado correspodiente
    if (cliente != null) {
      console.log("[next-step]: Mje enviado al monitor-io desde el disMonSocJson");
      // enviamos el mje al cliente
      cliente.emit('step', idCompra);
    }
    else{
      io.sockets.emit('resp-next-step','Servidor desconocido:'+from+'\n');
    }
  });

  // estado de todos los servidores
  socket.on('all-status', function(){
    console.log("[DIST_MON]: Se recibio el mje <all-status> del SERVER-PUG");
    
    // pedimos el estaod de todos los servidores
    for (cli of [comprasIO]) {
      console.log("[DIST_MON]: Se pide <srv-status> al MonSrv");
      cli.emit('srv-status');
    }

  });

  // se encarga de crear una compra desde cualquiera de los servidores
  socket.on('create-compra', function(data) {
    console.log("[DIST_MON]: Se recibio el mje <create-compra> del SERVER-PUG");
    // manda el mjes a la cola de compras para crear una compra nueva
    factoryMjes.create();
  });

  // socket.on('end',function () {
  //   console.log('Fin del socket: ' + socket.remoteAddress + ' ' + socket.remotePort);
  // });

  // socket.once('close',function (data) {
  //   console.log('Socket Cerrado: ' + socket.remoteAddress +' '+ socket.remotePort);
  // });

  // compras.on('data',function (data) {
  //   console.log("compras : "+data);
  //   // socket.sendMessage({result: mUtil.to_ObjJSON(data)});
  //   io.sockets.emit('messages', [mUtil.to_ObjJSON(data)]);
  // });

  // compras.on('close',function () {
  //   console.log('conexxion con compras perdida...');
  //   // socket.sendMessage({result: data});
  // });

  // Publicaciones.on('data',function (data) {
  //   console.log("publicaciones : "+data);
  //   socket.sendMessage({result: data});
  // });

  // Publicaciones.on('close',function () {
  //   console.log('conexión con Publicaciones perdida...');
  //   // socket.sendMessage({result: data});
  // });

  // web.on('data',function (data) {
  //   console.log("web : "+data);
  //   socket.sendMessage({result: data});
  // });

  // web.on('close',function () {
  //   console.log('conexión con web perdida...');
  //   // socket.sendMessage({result: data});
  // });

});

// #################################################################

// #################################################################
// ###################### Escuchando Monitores #####################
// #################################################################

// ##############################################
// ############## MON-COMPRAS ###################

// 
comprasIO.on('resp-mje-getAllCompras', function(data) {
  console.log("[resp-mje-getAllCompras]: Mje recibido del Monitor-IO: ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mje-status', data);
})
comprasIO.on('detalle-mje-getAllCompras', function(data) {
  console.log("[detalle-mje-getAllCompras]: Mje recibido del Monitor-IO: ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-mje-status-detalle', data);
})

// respuesta del sig paso
comprasIO.on('resp-mje-step', function(data) {
  console.log("[resp-mje-step]: Mje recibido del Monitor-IO: ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-next-step', data);
})

// escuchamos la resp del Monitor-IO
comprasIO.on('resp-mje-env-step', function(data) {
  console.log("[resp-mje-env-step]: Mje recibido del Monitor-IO: ",data);
  // se envia la info al server PUG
  io.sockets.emit('resp-env-step', data);
})

// escuchamos la resp del Monitor-IO del estado del servidor
comprasIO.on('resp-srv-status', function(data) {
  console.log("[resp-srv-status]: Mje recibido del Monitor-IO: ",data);
  // se envia la info al server PUG
  io.sockets.emit('srv-compras-status', data);
})

// ecuchamos acutualizaciones de tareas pendientes
comprasIO.on('update-tareas-pend', function(data) {
  console.log("[update-tareas-pend]: Mje recibido del Monitor-IO: ",data);
  // se envia la info al server PUG
  io.sockets.emit('tareas_pend_comp', data);
})

// ecuchamos la creacion de nuevas compras
comprasIO.on('update-cant-compras', function(data) {
  console.log("[update-cant-compras]: Mje recibido del Monitor-IO: ",data);
  // se envia la info al server PUG
  io.sockets.emit('upd_compras', data);
})

// ##############################################
// ############## MON- ###################


// ####################################################
// ################ Funciones privadas ################

function resolverCliente(server){
  console.log("Se va a resolver cliente: "+server);
  var cliente = null;
  switch (server) {
    case 'compras':
      cliente = compras;
      break;
    case 'compras-io':
      cliente = comprasIO;
      break;
    case 'publicaciones':
      cliente = Publicaciones;
      break;
    case 'web':
      cliente = web;
      break;
    default:
      console.log("Servidor desconocido");
      break;
  }

  return cliente;
}