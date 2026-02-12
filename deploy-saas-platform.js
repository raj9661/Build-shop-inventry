const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deploySaaSPlatform() {
  try {
    console.log('🚀 Deploying SaaS Enterprise Platform...\n');

    // Step 1: Create or get Platform Owner
    console.log('📋 Step 1: Creating Platform Owner...');
    let platformOwner = await prisma.platformOwner.findFirst({
      where: { email: 'admin@yourcompany.com' }
    });
    
    if (!platformOwner) {
      platformOwner = await prisma.platformOwner.create({
        data: {
          name: 'Platform Owner',
          email: 'admin@yourcompany.com',
          phone: '+1234567890',
          companyName: 'Your SaaS Company'
        }
      });
      console.log(`✅ Platform Owner created: ${platformOwner.id}`);
    } else {
      console.log(`✅ Platform Owner already exists: ${platformOwner.id}`);
    }

    // Step 2: Create or get Platform Owner User Account
    console.log('\n👤 Step 2: Creating Platform Owner User Account...');
    let platformUser = await prisma.user.findFirst({
      where: { email: 'admin@yourcompany.com' }
    });
    
    if (!platformUser) {
      platformUser = await prisma.user.create({
        data: {
          name: 'Platform Owner',
          username: 'platform_owner',
          email: 'admin@yourcompany.com',
          password: 'hashed_password_here', // Replace with actual hashed password
          role: 'PLATFORM_OWNER',
          isActive: true,
          emailVerified: true
        }
      });
      console.log(`✅ Platform Owner User created: ${platformUser.id}`);
    } else {
      console.log(`✅ Platform Owner User already exists: ${platformUser.id}`);
    }

    // Step 3: Create Sample Subscription Plans
    console.log('\n💳 Step 3: Setting up subscription plans...');
    
    // Create or get a sample customer for testing
    let sampleCustomer = await prisma.user.findFirst({
      where: { username: 'sample_customer' }
    });
    
    if (!sampleCustomer) {
      sampleCustomer = await prisma.user.create({
        data: {
          name: 'Sample Customer',
          username: 'sample_customer',
          email: 'customer@example.com',
          password: 'hashed_password_here',
          role: 'SUPER_DUPER_ADMIN',
          isActive: true,
          emailVerified: true
        }
      });
      console.log(`✅ Sample customer created: ${sampleCustomer.id}`);
    } else {
      console.log(`✅ Sample customer already exists: ${sampleCustomer.id}`);
    }

    // Create or get trial subscription
    let trialSubscription = await prisma.subscription.findFirst({
      where: { customerId: sampleCustomer.id }
    });
    
    if (!trialSubscription) {
      trialSubscription = await prisma.subscription.create({
        data: {
          customerId: sampleCustomer.id,
          plan: 'TRIAL_30_DAYS',
          status: 'TRIAL',
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
          trialEndDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          price: 0,
          currency: 'USD',
          autoRenew: true,
          createdBy: platformOwner.id
        }
      });
      console.log(`✅ Trial subscription created: ${trialSubscription.id}`);
    } else {
      console.log(`✅ Trial subscription already exists: ${trialSubscription.id}`);
    }

    // Step 4: Create Sample Shop for Customer
    console.log('\n🏪 Step 4: Creating sample shop...');
    const sampleShop = await prisma.shop.create({
      data: {
        name: 'Sample Construction Store',
        location: 'Sample City',
        phone: '+1234567890',
        email: 'shop@example.com',
        address: '123 Sample Street',
        gstNo: 'GST123456789'
      }
    });
    console.log(`✅ Sample shop created: ${sampleShop.id}`);

    // Step 5: Assign Customer to Shop
    console.log('\n🔗 Step 5: Assigning customer to shop...');
    const shopAssignment = await prisma.userShopAssignment.create({
      data: {
        userId: sampleCustomer.id,
        shopId: sampleShop.id,
        role: 'SUPER_DUPER_ADMIN',
        assignedById: platformUser.id
      }
    });
    console.log(`✅ Shop assignment created: ${shopAssignment.id}`);

    // Step 6: Create Sample TMT Data
    console.log('\n🔧 Step 6: Creating sample TMT data...');
    
    // Create TMT company
    const tmtCompany = await prisma.tmtCompany.create({
      data: {
        name: 'Sample TMT Company',
        shopId: sampleShop.id
      }
    });

    // Create TMT size
    const tmtSize = await prisma.tmtSize.create({
      data: {
        sizeMm: 12,
        shopId: sampleShop.id
      }
    });

    // Create TMT product
    const tmtProduct = await prisma.tmtProduct.create({
      data: {
        productName: 'Sample TMT Bar 12mm',
        companyId: tmtCompany.id,
        sizeId: tmtSize.id,
        weightPerRodKg: 4.5,
        rodsPerBundle: 20,
        weightPerBundleKg: 90,
        shopId: sampleShop.id
      }
    });

    // Create TMT inventory
    const tmtInventory = await prisma.tmtInventory.create({
      data: {
        productId: tmtProduct.id,
        shopId: sampleShop.id,
        availableQtyKg: 1000
      }
    });

    console.log(`✅ TMT data created: Company ${tmtCompany.id}, Product ${tmtProduct.id}, Inventory ${tmtInventory.id}`);

    // Step 7: Create or get Website Settings
    console.log('\n🌐 Step 7: Creating website settings...');
    let websiteSettings = await prisma.websiteSetting.findFirst({
      where: {
        customerId: sampleCustomer.id,
        type: 'SEO_META_TAGS',
        key: 'meta_tags'
      }
    });
    
    if (!websiteSettings) {
      websiteSettings = await prisma.websiteSetting.create({
        data: {
          customerId: sampleCustomer.id,
          type: 'SEO_META_TAGS',
          key: 'meta_tags',
          value: JSON.stringify({
            title: 'Sample Construction Store - TMT Bars & Building Materials',
            description: 'Your trusted supplier of TMT bars and construction materials',
            keywords: 'TMT bars, construction materials, building supplies'
          }),
          createdBy: platformOwner.id
        }
      });
      console.log(`✅ Website settings created: ${websiteSettings.id}`);
    } else {
      console.log(`✅ Website settings already exist: ${websiteSettings.id}`);
    }

    // Step 8: Create or get Platform Analytics
    console.log('\n📊 Step 8: Creating platform analytics...');
    let platformAnalytics = await prisma.platformAnalytics.findFirst({
      where: {
        metric: 'platform_overview',
        createdBy: platformOwner.id
      }
    });
    
    if (!platformAnalytics) {
      platformAnalytics = await prisma.platformAnalytics.create({
        data: {
          metric: 'platform_overview',
          value: 0, // Use numeric value instead of JSON string
          metadata: JSON.stringify({
            totalCustomers: 1,
            activeSubscriptions: 1,
            trialSubscriptions: 1,
            monthlyRevenue: 0
          }),
          recordedAt: new Date(),
          createdBy: platformOwner.id
        }
      });
      console.log(`✅ Platform analytics created: ${platformAnalytics.id}`);
    } else {
      console.log(`✅ Platform analytics already exist: ${platformAnalytics.id}`);
    }

    // Step 9: Create or get Sample Notification
    console.log('\n🔔 Step 9: Creating sample notification...');
    let notification = await prisma.notification.findFirst({
      where: {
        recipientId: sampleCustomer.id,
        title: 'Welcome to Your SaaS Platform!'
      }
    });
    
    if (!notification) {
      notification = await prisma.notification.create({
        data: {
          recipientId: sampleCustomer.id,
          recipientType: 'user',
          type: 'GENERAL',
          title: 'Welcome to Your SaaS Platform!',
          message: 'Thank you for starting your trial. Explore all the features available to you.',
          createdBy: platformOwner.id
        }
      });
      console.log(`✅ Sample notification created: ${notification.id}`);
    } else {
      console.log(`✅ Sample notification already exists: ${notification.id}`);
    }

    // Step 10: Create or get Usage Tracking
    console.log('\n📈 Step 10: Creating usage tracking...');
    let usageTracking = await prisma.subscriptionUsage.findFirst({
      where: {
        subscriptionId: trialSubscription.id,
        metric: 'users'
      }
    });
    
    if (!usageTracking) {
      usageTracking = await prisma.subscriptionUsage.create({
        data: {
          subscriptionId: trialSubscription.id,
          metric: 'users',
          usage: 1,
          limit: 1,
          period: 'monthly'
        }
      });
      console.log(`✅ Usage tracking created: ${usageTracking.id}`);
    } else {
      console.log(`✅ Usage tracking already exists: ${usageTracking.id}`);
    }

    console.log('\n🎉 SaaS Platform Deployment Complete!');
    console.log('\n📋 Summary:');
    console.log(`- Platform Owner: ${platformOwner.id}`);
    console.log(`- Platform User: ${platformUser.id}`);
    console.log(`- Sample Customer: ${sampleCustomer.id}`);
    console.log(`- Trial Subscription: ${trialSubscription.id}`);
    console.log(`- Sample Shop: ${sampleShop.id}`);
    console.log(`- TMT Product: ${tmtProduct.id}`);
    console.log(`- Website Settings: ${websiteSettings.id}`);
    console.log(`- Platform Analytics: ${platformAnalytics.id}`);

    console.log('\n🚀 Next Steps:');
    console.log('1. Update passwords with proper hashing');
    console.log('2. Setup payment processing (Stripe/Razorpay)');
    console.log('3. Create admin panels');
    console.log('4. Implement access control');
    console.log('5. Setup monitoring and alerts');
    console.log('6. Create customer onboarding flow');
    console.log('7. Launch your SaaS platform!');

  } catch (error) {
    console.error('❌ Error deploying SaaS platform:', error);
  } finally {
    await prisma.$disconnect();
  }
}

deploySaaSPlatform();
