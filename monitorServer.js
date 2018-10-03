var net = require('net');
var server = net.createServer();
var _ = require('underscore');


var MonitorServer = function (steper,comprasDB) {
  this.steper = steper;
  this.comprasDB = comprasDB;
  this.server = server;

  server.on('connection', function (sock) {
    console.log('Nueva Conexión');
    console.log('socket remoto: ' + sock.remoteAddress + ' ' + sock.remotePort);
    console.log('socket local: ' + sock.localAddress + ' ' + sock.localPort);

    sock.setEncoding('utf8');

    sock.on('data',function (data) {
      console.log('monitor --> ',data);
      var comandLine = data.trim().split(" ");
      switch (comandLine[0]) {
        case 'step':
          // recupera la compra en cuestión
          var compra = _.find(comprasDB,function (compra) {
            return compra.compra.compraId == comandLine[1];
          });
          if (compra) {
            steper.emit('manualStep',compra);
          } else {
            sock.write('No se encontró la compra: ' + comandLine[1]);
            sock.write('\n');
          }
          break;

        case 'getSteps':
          var compra = _.find(comprasDB,function (compra) {
            return compra.compra.compraId == comandLine[1];
          });
          if (compra) {
            sock.write(compra.stepsQ.toString());
            sock.write('\n');
          } else {
            sock.write('No se encontró la compra: ' + comandLine[1]);
            sock.write('\n');
          }
          break;

          case 'getCompra':
            var compra = _.find(comprasDB,function (compra) {
              return compra.compra.compraId == comandLine[1];
            });
            if (compra) {
              sock.write('**** Compra --> ' + JSON.stringify(compra.compra) + '\n*****************************\n');
              sock.write('\n');
            } else {
              sock.write('No se encontró la compra: ' + comandLine[1]);
              sock.write('\n');
            }
            break;

        case 'getAllCompras':
          if (comprasDB.length > 0) {
            for (compra of comprasDB) {
              sock.write('**** Compra --> ' + compra.compra.compraId + ' ****\n');
              sock.write('Comandos pendientes --> ' + compra.stepsQ.toString() + '\n');
              sock.write('*******************************************************\n')
              sock.write('\n');
            }
          } else {
            sock.write('No existe ninguna compra aún\n')
          }
          break;

        default:
          sock.write('Comando ' + comandLine[0] + ' desconocido');
          sock.write('\n');
      }
    });

    sock.on('end',function () {
      console.log('Fin del socket: ' + sock.remoteAddress + ' ' + sock.remotePort);
    });

    sock.once('close',function (data) {
      console.log('Socket Cerrado: ' + sock.remoteAddress +' '+ sock.remotePort);
    });

  });

}

module.exports = MonitorServer;
