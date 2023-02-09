# Steps to Deploy Contracts
1. Create instances on ComputeCanada:
   
   ```python3.9 create_instances.py```
2. Replace information in the `.env` file with created instance IP and initial accounts.
   1. replace bpet-contracts
   2. replace bpet-microservice
3. Go to contracts, deploy smart contracts to the besu network.

   ```yarn ts-node scripts/1-deploy.ts```

   After deployment, the scripts in `1-deploy.ts` will automatically update URLs and contract addresses to all the `.env` files.
4. Register participants to the deployed smart contracts.

    ```yarn ts-node scripts/2-registry.ts```
5. Launch backend microservices. Go to `admin`, `etk`, `gateway`, `poolmarket`, and `register`.
 
    ```yarn start:dev```
6. Launch frontend.

    ```yarn run dev```
7. Update MetaMask network setup.
