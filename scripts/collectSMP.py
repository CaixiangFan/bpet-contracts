from time import sleep
from datetime import datetime
import requests
import re
import csv
import pytz
import logging

url = 'http://ets.aeso.ca/ets_web/ip/Market/Reports/CSMPriceReportServlet?contentType=html'
mdt = pytz.timezone('America/Edmonton')
now = datetime.now(mdt).strftime('%Y-%m-%d-%H-%M-%S')
logging.basicConfig(filename='./data/SystemMarginalPrice-{}.log'.format(now), level=logging.DEBUG,
                    format='%(asctime)s %(levelname)s %(name)s %(message)s')
logger = logging.getLogger(__name__)
with open('./data/SystemMarginalPrice-{}.csv'.format(now), 'a+', newline='') as csv_file:
    fieldnames = ['Date', 'HE', 'Price', 'Minute']
    output_writer = csv.DictWriter(
        csv_file, fieldnames=fieldnames, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    output_writer.writerow(
        {'Date': 'Date', 'HE': 'HE', 'Price': 'Price', 'Minute': 'Minute'})
    while True:
        obj = {'Date': datetime.now(mdt).strftime('%m/%d/%Y')}
        try:
            res = requests.get(url, verify=True)
            dataObj = re.search(
                r'Hour Ending (?P<HE>[\d]+) is \$(?P<Price>[\d]+\.[\d]+) as of (?P<Minute>[\d]+\:[\d]+)', res.text).groupdict()
            obj.update(dataObj)
            output_writer.writerow(obj)
            csv_file.flush()
        except requests.ConnectionError as conn_err:
            logger.error(conn_err)
        except AttributeError as attr_error:
            # when re couln't match and 'NoneType' object has no attribute 'groupdict'
            logger.error(attr_error)
        except PermissionError as perm_err:
            logger.error(perm_err)
        except BaseException as err:
            logger.error(err)
        sleep(60)
