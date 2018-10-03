var net = require('net');
var server = net.createServer();
var _ = require('underscore');

var compras = new net.Socket();
compras.connect(6000,'127.0.0.1', function () {
  console.log('conectado al monitor de COMPRAS en el puerto 6000\n');
});

var Publicaciones = new net.Socket();
Publicaciones.connect(6001,'127.0.0.1', function () {
  console.log('conectado al monitor de Publicaciones en el puerto 6001\n');
});

var web = new net.Socket();
web.connect(6002,'127.0.0.1', function () {
  console.log('conectado al monitor de WEB en el puerto 6002\n');
});

server.listen(5000, function () {
  console.log('Servidor DISTRIBUTED MONITOR escuchando en el puerto %j', server.address());
});

server.on('connection', function (sock) {
  console.log('Nueva Conexión');
  console.log('socket remoto: ' + sock.remoteAddress + ' ' + sock.remotePort);
  console.log('socket local: ' + sock.localAddress + ' ' + sock.localPort);

  sock.setEncoding('utf8');

  sock.on('data',function (data) {
    console.log('distributed monitor --> ',data);
    var cliente = null;
    var commandLine = data.trim().split(" ");
    switch (commandLine[0]) {
      case 'compras':
        cliente = compras;
        break;
      case 'Publicaciones':
        cliente = Publicaciones;
        break;
      case 'web':
        cliente = web;
        break;

      case 'status':
        for (cli of [compras,Publicaciones,web]) {
          cli.write('getAllCompras');
        }
        break;

      default:
        sock.write('Servidor o comando' + commandLine[0] + ' desconocido\n');
    }

    if (cliente) {
      cliente.write(commandLine[1] + ' ' + commandLine[2]);
    }

  });

  sock.on('end',function () {
    console.log('Fin del socket: ' + sock.remoteAddress + ' ' + sock.remotePort);
  });

  sock.once('close',function (data) {
    console.log('Socket Cerrado: ' + sock.remoteAddress +' '+ sock.remotePort);
  });

  compras.on('data',function (data) {
    sock.write('COMPRAS: ' + data + '\n');
  });

  compras.on('close',function () {
    console.log('conexxion con compras perdida...');
    sock.write('conexxion con compras perdida...');
  });

  Publicaciones.on('data',function (data) {
    sock.write('Publicaciones' + data + '\n');
  });

  Publicaciones.on('close',function () {
    console.log('conexión con Publicaciones perdida...');
    sock.write('conexión con Publicaciones perdida...');
  });

  web.on('data',function (data) {
    sock.write('WEB: ' + data + '\n');
  });

  web.on('close',function () {
    console.log('conexión con web perdida...');
    sock.write('conexión con web perdida...');
  });

});
