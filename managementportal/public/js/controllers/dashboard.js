const dbController = angular.module('dashboardModule', ['csrService', 'angularDurationFormat'])
  .controller('dashboardController', ($scope, $http, $window, socket) => {
    $scope.Queues = [];
    $scope.qNames = [];
    $scope.queue = '';
    $scope.Agents = [];
    $scope.summary = {};
    $scope.summary.callers = 0;
    $scope.summary.completed = 0;
    $scope.summary.holdtime = 0;
    $scope.summary.abandoned = 0;
    $scope.summary.avgholdtime = 0;

    function CalculateSummary() {
      // initialize summary to zero since we are going to sum across all queues
      $scope.summary.callers = 0;
      $scope.summary.completed = 0;
      $scope.summary.abandoned = 0;
      let totalHoldTime = 0;
      for (let i = 0; i < $scope.Queues.length; i += 1) {
        $scope.summary.callers += Number($scope.Queues[i].callers);

        $scope.summary.completed += $scope.Queues[i].completed;

        $scope.summary.abandoned += $scope.Queues[i].abandoned;

        totalHoldTime += Number($scope.Queues[i].cumulativeHoldTime);
      }

      if ($scope.summary.completed > 0 && totalHoldTime > 0) {
        $scope.summary.avgholdtime = Number((totalHoldTime / $scope.summary.completed) / 60)
          .toFixed(2);
      } else {
        $scope.summary.avgholdtime = 0;
      }
    }

    function updateAgentStatusPieChart(agents) {
      const temp = agents.reduce((pIn, c) => {
        const p = pIn;
        const defaultValue = {
          status: c.status,
          data: 0
        };
        p[c.status] = p[c.status] || defaultValue;
        p[c.status].data += 1;

        return p;
      }, {});

      const agentStatusSummary = [];
      Object.keys(temp).forEach((k) => agentStatusSummary.push(temp[k]));

      // for (const k in temp) {
      //   agentStatusSummary.push(temp[k]);
      // }

      agentStatusSummary.forEach((e) => {
        e.label = e.status;
        delete e.status;
        // handle color logic for pie charts
        switch (e.label) {
          case 'Logged Out':
            e.color = '#d3d3d3';
            break;
          case 'In Call':
            e.color = '#d9534f';
            break;
          case 'Ready':
            e.color = '#5cb85c';
            break;
          case 'Away':
            e.color = '#f4f470';
            break;
          default:
            break;
        }
      });

      // Label formatter for flot pie chart
      function labelFormatter(label, series) {
        return `<div style="font-size:10pt; text-align:center; padding:2px; color:black;">${label}<br/>${Math.round(series.percent)} %</div>`;
      }

      $.plot('#agentStatusPieChart', agentStatusSummary, {
        series: {
          pie: {
            show: true,
            radius: 1,
            label: {
              show: true,
              radius: 0.6,
              formatter: labelFormatter,
              background: {
                opacity: 0.5
              }
            }
          }
        },
        legend: {
          show: false
        }
      });
    }

    // receives queue summary update every minute
    socket.on('queue', (data) => {
      $scope.Queues = data.queues;
      if (data.queues.length !== $scope.qNames.length) {
        $scope.qNames = [];
        for (let i = 0; i < data.queues.length; i += 1) {
          $scope.qNames.push(data.queues[i].queue);
        }
      }
    });

    function findAgent(scopeagents, dataagent) {
      for (let i = 0; i < scopeagents.length; i += 1) {
        if (scopeagents[i].agent === dataagent.agent) return scopeagents[i];
      }
      return null;
    }

    socket.on('agent-resp', (data) => {
      if (data.agents) {
        for (let i = 0; i < data.agents.length; i += 1) {
          const a = findAgent($scope.Agents, data.agents[i]);
          if (a) {
            Object.keys(data.agents[i]).forEach((prop) => { a[prop] = data.agents[i][prop]; });

            // for (const prop in data.agents[i]) {
            //   a[prop] = data.agents[i][prop];
            // }
          } else {
            $scope.Agents.push(data.agents[i]);
          }
        }

        updateAgentStatusPieChart(data.agents);
      }
    });

    socket.on('queue-resp', (data) => {
      $scope.Queues = data.queues;
      CalculateSummary();
    });

    // socket.on('sipconf', (data) => {
    //   // so the data can be accessed by non-angular javascript under the window element
    //   $window.sipconf = data;
    // });

    // socket.on('queueconf', (_data) => {
    //   $window.queueconf = data;
    // });

    socket.on('agent-request', (data) => {
      console.log(`Received agent-request help data...${JSON.stringify(data, null, 2, true)}`);

      for (let i = 0; i < $scope.Agents.length; i += 1) {
        if ($scope.Agents[i].agent === data) {
          console.log(`Extension needs assistance: ${$scope.Agents[i].agent}`);
          $scope.Agents[i].help = 'yes';
        }
      }
    });

    $scope.initData = function InitData() {
      // socket.emit('config', 'agent');
      // socket.emit('config', 'webuser');
      socket.emit('ami-req', 'agent');
      socket.emit('ami-req', 'queue');
    };

    angular.element(document).ready($scope.initData());
  });

dbController.directive('highlightOnChange', () => ({
  link(scope, element, attrs) {
    let timer;
    attrs.$observe('highlightOnChange', (val) => {
      if (val === 'yes') {
        timer = setInterval(() => {
          jQuery(element).addClass('agent-assistance');
          jQuery(element).fadeOut(500, () => {
            jQuery(element).fadeIn(1500);
          });
        }, 2000);
      } else {
        if (timer) clearInterval(timer);
        jQuery(element).removeClass('agent-assistance');
      }
    });
  }
}));

dbController.filter('shownum', () => function ShowNumFilter(input) {
  if (!input) {
    return 0;
  }

  return input;
});

dbController.filter('minsectimeformat', () => function MinSecTimeFormatFilter(input) {
  return moment.duration(Number(input), 'minutes').format('mm:ss', { trim: false });
});
