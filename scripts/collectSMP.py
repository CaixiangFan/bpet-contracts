from time import sleep
from datetime import datetime
import requests
import re
import csv
import pytz

url = 'http://ets.aeso.ca/ets_web/ip/Market/Reports/CSMPriceReportServlet?contentType=html'
mdt = pytz.timezone('America/Edmonton')
now = datetime.now(mdt).strftime('%Y-%m-%d-%H-%M-%S')
with open('./data/SystemMarginalPrice-{}.csv'.format(now), 'a+', newline='') as csv_file:
    fieldnames = ['Date', 'HE', 'Price', 'Minute']
    output_writer = csv.DictWriter(
        csv_file, fieldnames=fieldnames, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    output_writer.writerow(
        {'Date': 'Date', 'HE': 'HE', 'Price': 'Price', 'Minute': 'Minute'})
    while True:
        obj = {'Date': datetime.now(mdt).strftime('%m/%d/%Y')}
        res = requests.get(url, verify=True)
        dataObj = re.search(
            r"Hour Ending (?P<HE>[\d]+) is \$(?P<Price>[\d]+\.[\d]+) as of (?P<Minute>[\d]+\:[\d]+)", res.text).groupdict()
        obj.update(dataObj)
        output_writer.writerow(obj)
        csv_file.flush()
        sleep(60)
