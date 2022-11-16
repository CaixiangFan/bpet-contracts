import pandas as pd
from datetime import datetime, timedelta
import os
import progressbar as pb
import math
os.chdir('/mnt/bpet-contracts/data')
print(os.getcwd())


def download_data(reportName: str, beginDate: str, endDate: str) -> pd.DataFrame:
    baseURL = 'http://ets.aeso.ca/ets_web/ip/Market/Reports/'
    skiprows = [0, 1]
    maxDays = 1
    format = '%m%d%Y'
    beginDt = datetime.strptime(beginDate, format)
    endDt = datetime.strptime(endDate, format)
    if reportName == 'HistoricalSystemMarginalPrice':
        skiprows = [0, 2]
        maxDays = 31

    concatList = []
    currDate = beginDt
    total_downloads = math.ceil((endDt - beginDt).days / maxDays)
    bar = pb.ProgressBar(maxval=total_downloads,
                         widgets=[pb.Bar('=', '[', ']'), ' ', pb.Percentage()])
    bar.start()
    i = 0
    while currDate < endDt:
        nextDate = currDate + timedelta(days=maxDays)
        if nextDate > endDt:
            nextDate = endDt
        requestUrl = baseURL + '{}ReportServlet?beginDate={}&endDate={}&contentType=csv'.format(
            reportName, currDate.strftime(format), nextDate.strftime(format)
        )
        i += 1
        bar.update(i)
        df = pd.read_csv(requestUrl, skiprows=skiprows, engine='python')
        concatList.append(df)
        currDate = nextDate
    bar.finish()
    concatedDf = pd.concat(concatList)
    file = './{}_{}_{}.csv'.format(reportName, beginDate, endDate)
    concatedDf.to_csv(file)
    return concatedDf


download_data('HistoricalSystemMarginalPrice', '09012021', '08312022')
