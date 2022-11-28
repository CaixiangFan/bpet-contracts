from typing import List
import json
from datetime import datetime
import os
import subprocess
import yaml
import sys
from dotenv import load_dotenv

NETWORK_CONFIG_FILE = './networks/networkconfig.json'
NODES_IPADDRESS_FILE = '../../bpet/deploy/nodes.json'


def update_from_address_seed(n: int) -> None:
    config = {}
    with open(NETWORK_CONFIG_FILE, 'r') as config_file:
        config = json.load(config_file)
        current_seed = config['ethereum']['fromAddressSeed']
        new_seed = current_seed[:-1] + str(n)
        config['ethereum']['fromAddressSeed'] = new_seed
    with open(NETWORK_CONFIG_FILE, 'w') as config_file:
        json.dump(config, config_file, indent=4)


def update_net_config():
    with open(NODES_IPADDRESS_FILE, 'r') as ip_file:
        ip_addrs = json.load(ip_file)
        rpc_ip = ip_addrs['besu-1']
    load_dotenv()
    with open(NETWORK_CONFIG_FILE, 'r') as config_file:
        config = json.load(config_file)
        # update url and contracts' addresses
        config['ethereum']['url'] = "ws://{}:8546".format(rpc_ip)
        config['ethereum']['contracts']['registry']['address'] = os.environ.get(
            'REGISTRY_CONTRACT_ADDRESS')
        config['ethereum']['contracts']['poolmarket']['address'] = os.environ.get(
            'POOLMARKET_CONTRACT_ADDRESS')
        config['ethereum']['contracts']['etk']['address'] = os.environ.get(
            'TOKEN_CONTRACT_ADDRESS')
    with open(NETWORK_CONFIG_FILE, 'w') as config_file:
        json.dump(config, config_file, indent=4)


def run(SEND_RATES: List, BENCH_TYPE: str) -> None:
    benchconfig = './benchmarks/scenario/{}/config.yaml'.format(BENCH_TYPE)
    directory = 'reports/' + BENCH_TYPE
    replicas = 5  # test replicas for each send rate
    for tps in SEND_RATES:
        # update the benchmark config file
        with open(benchconfig, 'r') as f:
            y = yaml.safe_load(f)
            y['test']['workers']['number'] = tps
            y['test']['rounds'][0]['txNumber'] = tps
            y['test']['rounds'][0]['rateControl']['opts']['tps'] = tps
            y['test']['rounds'][0]['workload']['arguments']['numberOfAccounts'] = tps
            y['test']['rounds'][1]['txNumber'] = tps
            y['test']['rounds'][1]['rateControl']['opts']['tps'] = tps
            y['test']['rounds'][1]['workload']['arguments']['numberOfAccounts'] = tps
        with open(benchconfig, 'w') as f:
            yaml.dump(y, f, default_flow_style=False,
                      sort_keys=False, indent=4)
        # run benchmarking for each replica
        for i in range(replicas):
            update_from_address_seed(i)
            subprocess.run(['docker', 'compose', '-f',
                            'docker-compose-{}.yaml'.format(BENCH_TYPE), 'up'])
            subprocess.run(
                ['mv', 'reports/{}-report.html'.format(BENCH_TYPE), '{}/{}-report-{}-{}.html'.format(directory, BENCH_TYPE, tps, i+1)])
            subprocess.run(['sleep', '10'])
        # mint tokens for benchmarking transfer
    if BENCH_TYPE == 'registry':
        subprocess.run(
            ['yarn', 'ts-node', '/mnt/bpet-contracts/scripts/10-mintETK.ts', 'mint'])


if __name__ == "__main__":
    update_net_config()
    # deploy smart contracts
    subprocess.run(
        ['yarn', 'ts-node', '/mnt/bpet-contracts/scripts/1-deploy.ts'])
    sendRates = [40]
    # bench_types = ['registry', 'etk', 'market']
    bench_types = ['registry']
    for bench_type in bench_types:
        run(SEND_RATES=sendRates, BENCH_TYPE=bench_type)
