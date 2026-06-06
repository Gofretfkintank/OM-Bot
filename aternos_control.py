import sys, os

action = sys.argv[1] if len(sys.argv) > 1 else 'status'

try:
    from python_aternos import Client
    
    client = Client()
    client.login_with_session(os.environ['ATERNOS_SESSION'])
    server = client.account.list_servers()[0]

    if action == 'status':
        print(server.status.lower())
    elif action == 'start':
        server.start()
        print('starting')
    elif action == 'stop':
        server.stop()
        print('stopping')

except Exception as e:
    print(f'ERROR:{e}')
    sys.exit(1)