/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

'use strict';

const { WorkloadModuleBase } = require('@hyperledger/caliper-core');

const SupportedConnectors = ['ethereum'];

/**
 * Base class for simple operations.
 */
class OperationBase extends WorkloadModuleBase {
    /**
     * Initializes the base class.
     */
    constructor() {
        super();
    }

    /**
     * Initialize the workload module with the given parameters.
     * @param {number} workerIndex The 0-based index of the worker instantiating the workload module.
     * @param {number} totalWorkers The total number of workers participating in the round.
     * @param {number} roundIndex The 0-based index of the currently executing round.
     * @param {Object} roundArguments The user-provided arguments for the round from the benchmark configuration file.
     * @param {ConnectorBase} sutAdapter The adapter of the underlying SUT.
     * @param {Object} sutContext The custom context object provided by the SUT adapter.
     * @async
     */
    async initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext) {
        await super.initializeWorkloadModule(workerIndex, totalWorkers, roundIndex, roundArguments, sutAdapter, sutContext);

        this.assertConnectorType();
        this.assertSetting('numberOfAccounts');
        this.assertSetting('assetID');
        this.assertSetting('blockAmount');
        this.assertSetting('capacity');
        this.assertSetting('offerControl');

        this.assertSetting('consumerAssetID');
        this.assertSetting('consumerLoad');
        this.assertSetting('consumerOfferControl');

        this.numberOfAccounts = this.roundArguments.numberOfAccounts;
        this.account = this.sutContext.fromAddress;
        this.assetID = this.roundArguments.assetID;
        this.blockAmount = this.roundArguments.blockAmount;
        this.capacity = this.roundArguments.capacity;
        this.offerControl = this.roundArguments.offerControl;

        this.consumerAssetID = this.roundArguments.consumerAssetID;
        this.consumerLoad = this.roundArguments.consumerLoad;
        this.consumerOfferControl = this.roundArguments.consumerOfferControl;

        this.simpleState = this.createSimpleState();
    }

    /**
     * Performs the operation mode-specific initialization.
     * @return {SimpleState} the initialized SimpleState instance.
     * @protected
     */
    createSimpleState() {
        throw new Error('Simple workload error: "createSimpleState" must be overridden in derived classes');
    }

    /**
     * Assert that the used connector type is supported. Only Fabric is supported currently.
     * @protected
     */
    assertConnectorType() {
        this.connectorType = this.sutAdapter.getType();
        if (!SupportedConnectors.includes(this.connectorType)) {
            throw new Error(`Connector type ${this.connectorType} is not supported by the benchmark`);
        }
    }

    /**
     * Assert that a given setting is present among the arguments.
     * @param {string} settingName The name of the setting.
     * @protected
     */
    assertSetting(settingName) {
        if(!this.roundArguments.hasOwnProperty(settingName)) {
            throw new Error(`Simple workload error: module setting "${settingName}" is missing from the benchmark configuration file`);
        }
    }

    /**
     * Assemble a connector-specific request from the business parameters.
     * @param {string} operation The name of the operation to invoke.
     * @param {object} args The object containing the arguments.
     * @return {object} The connector-specific request.
     * @protected
     */
    createConnectorRequest(operation, args) {
        switch (this.connectorType) {
            case 'ethereum':
                return this._createEthereumConnectorRequest(operation, args);
            default:
                // this shouldn't happen
                throw new Error(`Connector type ${this.connectorType} is not supported by the benchmark`);
        }
    }


    /**
     * Assemble a Ethereum-specific request from the business parameters.
     * @param {string} operation The name of the operation to invoke.
     * @param {object} args The object containing the arguments.
     * @return {object} The Ethereum-specific request.
     * @private
     */
    _createEthereumConnectorRequest(operation, args) {
        const query = operation === 'query';
        return {
            contract: 'registry',
            verb: operation,
            args: Object.keys(args).map(k => args[k]),
            readOnly: query
        };
    }
}

module.exports = OperationBase;
