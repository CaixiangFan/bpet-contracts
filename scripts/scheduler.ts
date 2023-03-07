import * as schedule from 'node-schedule';

schedule.scheduleJob('7 * * * * *', () => {
  console.log('node-schedule running a task every minute at the 7th second');
});

// console.log(Date.parse("2022-03-01 01:00:00"));
// console.log(new Date(Date.parse("2022-03-01 1:00:00")));

// var offset = new Date("2023-03-07 1:00:00").getTime() - new Date("2022-03-01 1:00:00").getTime();
// console.log(offset);

// var number = 15;
// moment(number.toString(),"LT")
