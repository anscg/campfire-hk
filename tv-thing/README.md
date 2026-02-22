# campfire hk tv thing

code powering the lobby TV for [Campfire HK](https://campfire.hk).

(forked from [epoch tv thing](https://github.com/hackclub/epoch-tv-thing))

((forked from [assemble tv thing](https://github.com/hackclub/assemble-tv-thing)))

use this for your campfire:
```
find . -type f -exec sed -i 's/Hong Kong/your city here/g' {} +
```
replace your city here with your city name

## how to run

```
yarn start
```

then check out:

- http://localhost:3000
- http://localhost:3000/display
- http://localhost:3000/admin
